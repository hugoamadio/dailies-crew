import fs from 'node:fs/promises';
import { resetDb, testDb } from '@dailies-crew/db/test';
import type { VoiceProvider } from '@dailies-crew/engine/voice';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goodDirection } from '../../../test/direction-fixtures';
import { LAMP_SVG, productInput, productLineInput, tempDataDir } from '../../../test/fixtures';
import { drain, testContext } from '../../../test/studio';
import { MAX_REVIEW_ROUNDS } from '../../crew/reviewer';
import { runStage } from '../runner';
import { createFakeLlm } from '../../crew/fake';
import { createLine } from '../../lines/service';
import { createProduct } from '../../products/service';
import { STAGES } from '../stages';
import { STAGE_HANDLERS } from './index';

const db = testDb();
let dataDir: string;
beforeEach(async () => {
  await resetDb(db);
  dataDir = await tempDataDir();
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});
afterAll(async () => {
  await db.$disconnect();
});

async function productVideo() {
  const line = await createLine({ db, dataDir }, productLineInput());
  const product = await createProduct({ db, dataDir }, productInput(), [LAMP_SVG]);
  return db.video.create({ data: { lineId: line.id, productId: product.id } });
}

const adjust = {
  verdict: 'adjust',
  notes: 'The hook is weak',
  adjustments: [{ stage: 'script', instruction: 'Open with the price' }],
};
const approve = { verdict: 'approve', notes: 'Looks good', adjustments: [] };

describe('the stages together', () => {
  it('take a product video from prepare to ready for review, for free with the fake AI', async () => {
    const ctx = testContext(db, dataDir);
    const video = await productVideo();
    await ctx.queue.enqueue('prepare', video.id);

    const ran = await drain(ctx, STAGE_HANDLERS);

    expect(ran.map((job) => job.stage)).toEqual([...STAGES]);
    const done = await db.video.findUniqueOrThrow({ where: { id: video.id } });
    expect(done).toMatchObject({
      status: 'ready_for_review',
      round: 0,
      videoFile: `jobs/${video.id}/video.mp4`,
      costUsd: 0,
    });
    expect(done.frameFiles).toHaveLength(4);
    expect(done.briefing).toMatchObject({ keyFacts: ['Luminária Lua', 'R$ 89,90'] });
    expect(done.social).toMatchObject({ tiktok: { hashtags: ['#luminaria', '#lua'] } });
    const ideas = await db.idea.findMany({ where: { videoId: video.id } });
    expect(ideas).toHaveLength(6);
    expect(ideas.filter((idea) => idea.status === 'chosen')).toHaveLength(1);
    // 1 preparer + 3 creators + 3 judges + 1 scriptwriter + 1 director + 3 reviewers + 1 social
    const costs = await db.costEntry.findMany({ where: { videoId: video.id } });
    expect(costs.filter((cost) => cost.role !== 'voice')).toHaveLength(13);
    // and one voice synthesis per script line
    expect(costs.filter((cost) => cost.role === 'voice')).toHaveLength(5);
    expect(costs.every((cost) => cost.usd === 0)).toBe(true);
  });

  it('send the video back to the script when a reviewer asks, with the instruction', async () => {
    const llm = createFakeLlm().script('reviewer', adjust);
    const ctx = testContext(db, dataDir, { llm });
    const video = await productVideo();
    await ctx.queue.enqueue('prepare', video.id);

    const ran = await drain(ctx, STAGE_HANDLERS);

    expect(ran.map((job) => job.stage)).toEqual([
      ...STAGES.slice(0, 7),
      'script',
      'direction',
      'produce',
      'review',
      'social',
    ]);
    const done = await db.video.findUniqueOrThrow({ where: { id: video.id } });
    expect(done).toMatchObject({ status: 'ready_for_review', round: 1, reviewRounds: 1 });
    const rework = llm.calls.filter((call) => call.role === 'scriptwriter')[1]!;
    expect((rework.content[0] as { text: string }).text).toContain('- (art) Open with the price');
  });

  it('hand the video to Hugo after two review rounds that still ask for changes', async () => {
    // per round the art reviewer answers first, then rhythm and fidelity
    const round = [adjust, approve, approve];
    const llm = createFakeLlm().script('reviewer', ...round, ...round, ...round);
    const ctx = testContext(db, dataDir, { llm });
    const video = await productVideo();
    await ctx.queue.enqueue('prepare', video.id);
    await drain(ctx, STAGE_HANDLERS);

    expect(await db.video.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({
      status: 'needs_you',
      round: 2,
      problems: ['script: (art) Open with the price'],
    });
  });

  it('hand the video to Hugo when the director fails three times, with every attempt kept', async () => {
    const broken = {
      ...goodDirection,
      scenes: goodDirection.scenes.map((scene) => ({ ...scene, paramsJson: '[]' })),
    };
    const llm = createFakeLlm().script('director', broken, broken, broken);
    const ctx = testContext(db, dataDir, { llm });
    const video = await productVideo();
    await ctx.queue.enqueue('prepare', video.id);
    await drain(ctx, STAGE_HANDLERS);

    const stopped = await db.video.findUniqueOrThrow({ where: { id: video.id } });
    expect(stopped.status).toBe('needs_you');
    expect(stopped.problems[0]).toBe(
      'The director could not write a valid plan in 3 attempts. Last problems:',
    );
    expect(llm.calls.filter((call) => call.role === 'director')).toHaveLength(3);
    const run = await db.stageRun.findFirstOrThrow({
      where: { videoId: video.id, stage: 'direction' },
    });
    expect((run.output as { data: { attempts: unknown[] } }).data.attempts).toHaveLength(3);
  });

  it('send the plan back to the director when the real voice is longer than the estimate', async () => {
    let calls = 0;
    // the first take of every line lasts 14 s (too long for a hook); the next ones 4 s
    const slowVoice: VoiceProvider = {
      name: 'fake',
      synthesize: async (request) => ({
        audio: new Uint8Array(),
        extension: 'wav',
        words: [{ text: request.text, startSeconds: 0, endSeconds: 1 }],
        durationSeconds: calls++ < 5 ? 14 : 4,
        characters: request.text.length,
      }),
    };
    const ctx = testContext(db, dataDir, { voices: () => slowVoice });
    const video = await productVideo();
    await ctx.queue.enqueue('prepare', video.id);
    await drain(ctx, STAGE_HANDLERS);

    const done = await db.video.findUniqueOrThrow({ where: { id: video.id } });
    expect(done).toMatchObject({ status: 'ready_for_review', round: 1, reviewRounds: 1 });
    const instructions = done.instructions as { stage: string; instruction: string }[];
    expect(instructions.every((item) => item.stage === 'direction')).toBe(true);
    expect(instructions[0]!.instruction).toContain('piece "hook-question" lasts at most 6 s');
  });

  it('hand the video to Hugo when the real voice stays too slow in every round', async () => {
    const slowVoice: VoiceProvider = {
      name: 'fake',
      synthesize: async (request) => ({
        audio: new Uint8Array(),
        extension: 'wav',
        words: [{ text: request.text, startSeconds: 0, endSeconds: 1 }],
        durationSeconds: 14,
        characters: request.text.length,
      }),
    };
    let produced = 0;
    const base = testContext(db, dataDir);
    const ctx = testContext(db, dataDir, {
      voices: () => slowVoice,
      produce: (options) => {
        produced += 1;
        return base.produce(options);
      },
    });
    const video = await productVideo();
    await ctx.queue.enqueue('prepare', video.id);
    await drain(ctx, STAGE_HANDLERS);

    const stopped = await db.video.findUniqueOrThrow({ where: { id: video.id } });
    expect(stopped).toMatchObject({ status: 'needs_you', reviewRounds: MAX_REVIEW_ROUNDS });
    expect(stopped.problems[0]).toBe('The plan does not fit the real voice:');
    expect(produced).toBe(MAX_REVIEW_ROUNDS + 1);
    // the instruction reads cleanly, without the list dash
    const instructions = stopped.instructions as { instruction: string }[];
    expect(instructions[0]!.instruction).toMatch(/fix it: [^-]/);
  });

  it('send the plan to the script when the whole video is too short', async () => {
    const quickVoice: VoiceProvider = {
      name: 'fake',
      synthesize: async (request) => ({
        audio: new Uint8Array(),
        extension: 'wav',
        words: [{ text: request.text, startSeconds: 0, endSeconds: 0.5 }],
        durationSeconds: 1,
        characters: request.text.length,
      }),
    };
    const ctx = testContext(db, dataDir, { voices: () => quickVoice });
    const video = await productVideo();
    await ctx.queue.enqueue('prepare', video.id);
    await drain(ctx, STAGE_HANDLERS);

    const after = await db.video.findUniqueOrThrow({ where: { id: video.id } });
    const instructions = after.instructions as { stage: string }[];
    expect(instructions.length).toBeGreaterThan(0);
    expect(instructions.every((item) => item.stage === 'script')).toBe(true);
  });
});

describe('the committee and the bank', () => {
  // the three judges: every idea 0, except the banked one (the seventh) 10
  const favour = (key: string) => ({
    scores: Array.from({ length: 7 }, (_, index) => ({
      ideaId: `idea-${index + 1}`,
      score: `idea-${index + 1}` === key ? 10 : 0,
      reason: 'test',
    })),
  });

  async function bankedIdea(video: { lineId: string; productId: string | null }) {
    return db.idea.create({
      data: {
        lineId: video.lineId,
        productId: video.productId,
        style: 'funny',
        title: 'Banked moon',
        hook: 'A hook',
        angle: 'An angle',
        structure: ['one', 'two'],
        cta: 'Link in bio',
        scores: {},
        total: 25,
        status: 'banked',
      },
    });
  }

  it('lets a banked idea of the same subject win and become used by this video', async () => {
    const video = await productVideo();
    const banked = await bankedIdea(video);
    const llm = createFakeLlm().script(
      'judge',
      favour('idea-7'),
      favour('idea-7'),
      favour('idea-7'),
    );
    const ctx = testContext(db, dataDir, { llm });
    await ctx.queue.enqueue('prepare', video.id);
    await drain(ctx, STAGE_HANDLERS);

    expect(await db.idea.findUniqueOrThrow({ where: { id: banked.id } })).toMatchObject({
      status: 'used',
      videoId: video.id,
      total: 30,
    });
    const own = await db.idea.findMany({ where: { videoId: video.id, status: 'chosen' } });
    expect(own).toHaveLength(0);
  });

  it('fails the committee with a retryable error when another video took the banked winner', async () => {
    const video = await productVideo();
    const banked = await bankedIdea(video);
    const llm = createFakeLlm().script(
      'judge',
      favour('idea-7'),
      favour('idea-7'),
      favour('idea-7'),
    );
    const ctx = testContext(db, dataDir, { llm });
    const other = await db.video.create({
      data: { lineId: video.lineId, productId: video.productId },
    });
    // the other video takes the idea after the judges read the bank, before this one saves
    const handlers = {
      ...STAGE_HANDLERS,
      committee: async (...args: Parameters<typeof STAGE_HANDLERS.committee>) => {
        const result = await STAGE_HANDLERS.committee(...args);
        await db.idea.update({
          where: { id: banked.id },
          data: { status: 'used', videoId: other.id },
        });
        return result;
      },
    };
    await ctx.queue.enqueue('prepare', video.id);
    while (ctx.queue.jobs.length > 0) {
      const job = ctx.queue.jobs.shift()!;
      const attempt = runStage(ctx, job.stage, { videoId: video.id, lastAttempt: false }, handlers);
      if (job.stage === 'committee') {
        await expect(attempt).rejects.toThrow(/taken by another video/);
        break;
      }
      await attempt;
    }

    expect(await db.idea.findUniqueOrThrow({ where: { id: banked.id } })).toMatchObject({
      status: 'used',
      videoId: other.id,
    });
    expect(await db.idea.count({ where: { videoId: video.id } })).toBe(0);
    const left = await db.video.findUniqueOrThrow({ where: { id: video.id } });
    expect(left.stage).toBe('committee');
  });
});
