import fs from 'node:fs/promises';
import { resetDb, testDb } from '@dailies-crew/db/test';
import type { VoiceProvider } from '@dailies-crew/engine/voice';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { goodDirection } from '../../../test/direction-fixtures';
import { LAMP_SVG, productInput, productLineInput, tempDataDir } from '../../../test/fixtures';
import { drain, testContext } from '../../../test/studio';
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
});
