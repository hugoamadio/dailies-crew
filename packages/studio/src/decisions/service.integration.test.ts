import fs from 'node:fs/promises';
import path from 'node:path';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDataDir, topicLineInput } from '../../test/fixtures';
import { testContext } from '../../test/studio';
import { createFakeLlm } from '../crew/fake';
import { createLine } from '../lines/service';
import { LlmError } from '../llm/errors';
import { approveVideo, rejectVideo } from './service';

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

async function readyVideo(
  status: 'ready_for_review' | 'needs_you' | 'running' = 'ready_for_review',
) {
  const line = await createLine({ db, dataDir }, topicLineInput());
  return db.video.create({
    data: {
      lineId: line.id,
      status,
      stage: 'social',
      round: 1,
      reviewRounds: 2,
      videoFile: 'jobs/x/video.mp4',
      briefing: { summary: 'x' },
      script: { lines: [{ text: 'Uma linha' }] },
      // "needs you" from the director: a script, no plan yet
      ...(status === 'needs_you' ? {} : { plan: { version: 1 } }),
    },
  });
}

describe('approveVideo', () => {
  it('marks the video approved and ready to post, and writes the decision', async () => {
    const ctx = testContext(db, dataDir);
    const video = await readyVideo();
    const approved = await approveVideo(ctx, video.id);
    expect(approved).toMatchObject({
      status: 'approved',
      publication: { adapter: 'manual', state: 'ready_to_post', url: null },
    });
    expect(await db.decision.findFirstOrThrow()).toMatchObject({
      videoId: video.id,
      kind: 'approve',
    });
  });

  it('a double approve records one decision; approving after a redo started throws', async () => {
    const ctx = testContext(db, dataDir);
    const video = await readyVideo();
    const results = await Promise.allSettled([
      approveVideo(ctx, video.id),
      approveVideo(ctx, video.id),
    ]);
    expect(results.map((each) => each.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(await db.decision.count()).toBe(1);

    const other = await readyVideo();
    await rejectVideo(ctx, other.id, {
      reason: 'A voz ficou robótica',
      mode: 'redo',
      targetStage: 'script',
    });
    await expect(approveVideo(ctx, other.id)).rejects.toThrow('only a video ready for review');
    expect((await db.video.findUniqueOrThrow({ where: { id: other.id } })).status).toBe('running');
  });

  it('refuses a needs-you video that has no render', async () => {
    const ctx = testContext(db, dataDir);
    const video = await readyVideo('needs_you');
    await db.video.update({ where: { id: video.id }, data: { videoFile: null } });
    await expect(approveVideo(ctx, video.id)).rejects.toThrow('no finished video to approve');
    expect((await db.video.findUniqueOrThrow({ where: { id: video.id } })).status).toBe(
      'needs_you',
    );
  });

  it('refuses a video still in production', async () => {
    const ctx = testContext(db, dataDir);
    const video = await readyVideo('running');
    await expect(approveVideo(ctx, video.id)).rejects.toThrow(
      'only a video ready for review or needing you can be decided',
    );
  });
});

describe('rejectVideo', () => {
  it('learn: the reason becomes a rule of the line and the video is rejected', async () => {
    const ctx = testContext(db, dataDir);
    const video = await readyVideo();
    const result = await rejectVideo(ctx, video.id, {
      reason: 'Nunca mostre o preço antes do produto',
      mode: 'learn',
    });
    expect(result.rule).toBe('Avoid this: Nunca mostre o preço antes do produto');
    expect(await db.learnedRule.findFirstOrThrow()).toMatchObject({
      lineId: video.lineId,
      text: 'Avoid this: Nunca mostre o preço antes do produto',
      sourceVideoId: video.id,
      active: true,
    });
    expect((await db.video.findUniqueOrThrow({ where: { id: video.id } })).status).toBe('rejected');
    expect(await db.decision.findFirstOrThrow()).toMatchObject({ kind: 'reject', mode: 'learn' });
    expect(await db.costEntry.findFirstOrThrow()).toMatchObject({
      role: 'rejection-router',
      usd: 0,
    });
  });

  it('learn: keeps the reason itself as the rule when the router cannot answer', async () => {
    const llm = createFakeLlm().script('rejection-router', new LlmError('network', 'down', true));
    const ctx = testContext(db, dataDir, { llm });
    const video = await readyVideo();
    expect(
      (await rejectVideo(ctx, video.id, { reason: 'Música alta demais', mode: 'learn' })).rule,
    ).toBe('Música alta demais');
  });

  it('redo: back to the stage Hugo chose, in a new round with his reason and fresh review rounds', async () => {
    const ctx = testContext(db, dataDir);
    const video = await readyVideo();
    const jobDir = path.join(dataDir, 'jobs', video.id);
    await fs.mkdir(path.join(jobDir, 'voice-cache'), { recursive: true });
    await fs.writeFile(path.join(jobDir, 'voice-cache.json'), '{}');

    const result = await rejectVideo(ctx, video.id, {
      reason: 'A voz ficou robótica',
      mode: 'redo',
      targetStage: 'produce',
    });

    expect(result.stage).toBe('produce');
    expect(await db.video.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({
      status: 'running',
      stage: 'produce',
      round: 2,
      reviewRounds: 0,
      instructions: [{ stage: 'produce', instruction: 'A voz ficou robótica', source: 'hugo' }],
    });
    expect(ctx.queue.jobs).toEqual([{ stage: 'produce', videoId: video.id }]);
    // a new voice take: the cached voice is gone
    await expect(fs.access(path.join(jobDir, 'voice-cache.json'))).rejects.toThrow();
    expect(await db.decision.findFirstOrThrow()).toMatchObject({
      mode: 'redo',
      targetStage: 'produce',
    });
  });

  it('redo: drops the render of the round before, and the plan when it restarts at script', async () => {
    const ctx = testContext(db, dataDir);
    const first = await readyVideo();
    await db.video.update({
      where: { id: first.id },
      data: { frameFiles: ['jobs/x/a.jpeg'], durationSeconds: 9, social: { tiktok: {} } },
    });
    await rejectVideo(ctx, first.id, {
      reason: 'A voz ficou robótica',
      mode: 'redo',
      targetStage: 'produce',
    });
    expect(await db.video.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      videoFile: null,
      frameFiles: [],
      durationSeconds: null,
      social: null,
      plan: { version: 1 },
    });
    const second = await readyVideo();
    await rejectVideo(ctx, second.id, {
      reason: 'Roteiro fraco',
      mode: 'redo',
      targetStage: 'script',
    });
    expect((await db.video.findUniqueOrThrow({ where: { id: second.id } })).plan).toBeNull();
  });

  it('redo: the router picks the stage when Hugo does not', async () => {
    const ctx = testContext(db, dataDir);
    const video = await readyVideo();
    const result = await rejectVideo(ctx, video.id, {
      reason: 'O roteiro está longo demais',
      mode: 'redo',
    });
    expect(result.stage).toBe('script');
  });

  it('redo: never sends a video to a stage it never reached', async () => {
    const ctx = testContext(db, dataDir);
    const video = await readyVideo('needs_you');
    await expect(
      rejectVideo(ctx, video.id, {
        reason: 'A voz ficou robótica',
        mode: 'redo',
        targetStage: 'produce',
      }),
    ).rejects.toThrow('never got to produce; send it back to an earlier stage');
    // the router asks for produce ("voz"): the video goes to the director instead
    const result = await rejectVideo(ctx, video.id, {
      reason: 'A voz ficou robótica',
      mode: 'redo',
    });
    expect(result.stage).toBe('direction');
  });

  it('two redos at once: one wins, one job, round counted once', async () => {
    const ctx = testContext(db, dataDir);
    const video = await readyVideo();
    const input = { reason: 'Roteiro fraco', mode: 'redo', targetStage: 'script' };
    const results = await Promise.allSettled([
      rejectVideo(ctx, video.id, input),
      rejectVideo(ctx, video.id, input),
    ]);
    expect(results.map((each) => each.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(ctx.queue.jobs).toHaveLength(1);
    expect((await db.video.findUniqueOrThrow({ where: { id: video.id } })).round).toBe(2);
    expect(await db.decision.count()).toBe(1);
  });

  it('redo: a voice complaint on a video without a plan keeps its meaning', async () => {
    const ctx = testContext(db, dataDir);
    const video = await readyVideo('needs_you');
    await rejectVideo(ctx, video.id, { reason: 'A voz ficou robótica', mode: 'redo' });
    expect((await db.video.findUniqueOrThrow({ where: { id: video.id } })).instructions).toEqual([
      { stage: 'direction', instruction: 'About the voice: A voz ficou robótica', source: 'hugo' },
    ]);
  });

  it('learn with a target stage makes no sense', async () => {
    const ctx = testContext(db, dataDir);
    const video = await readyVideo();
    await expect(
      rejectVideo(ctx, video.id, {
        reason: 'Música alta demais',
        mode: 'learn',
        targetStage: 'script',
      }),
    ).rejects.toThrow('only makes sense with "redo"');
  });

  it('wants a reason', async () => {
    const ctx = testContext(db, dataDir);
    const video = await readyVideo();
    await expect(rejectVideo(ctx, video.id, { reason: '', mode: 'learn' })).rejects.toThrow(
      'Invalid rejection:\n- reason:',
    );
  });
});
