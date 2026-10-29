import fs from 'node:fs/promises';
import { resetDb, testDb } from '@dailies-crew/db/test';
import {
  createLine,
  createProduct,
  listRules,
  runLineTick,
  STAGE_HANDLERS,
} from '@dailies-crew/studio';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LAMP_SVG,
  productInput,
  productLineInput,
  tempDataDir,
} from '../../../../../packages/studio/test/fixtures';
import { drain } from '../../../../../packages/studio/test/studio';
import { formOf, t, testPanel } from '../../test/panel';
import { loadAllVideos, loadReviewQueue, loadVideo } from '../loaders/videos';
import { approve, reject, rejectInputFromForm } from './videos';

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

/** A video made by the whole fake crew (fake AI, quick fake render): ready for review */
async function readyVideo(panel: ReturnType<typeof testPanel>) {
  const line = await createLine(panel.ctx, productLineInput());
  await createProduct(panel.ctx, productInput(), [LAMP_SVG]);
  const { created } = await runLineTick(panel.ctx, line.id, { count: 1 });
  await drain(panel.ctx, STAGE_HANDLERS);
  return { lineId: line.id, videoId: created[0]! };
}

describe('the review page', () => {
  it('loads the video, its posts, the review round, the frames and the cost of each stage', async () => {
    const panel = testPanel(db, dataDir);
    const { videoId } = await readyVideo(panel);
    const data = await loadVideo(db, videoId);
    expect(data.video).toMatchObject({ status: 'ready_for_review', title: 'Luminária Lua' });
    expect(data.videoUrl).toMatch(new RegExp(`^/files/jobs/${videoId}/video\\.mp4\\?v=\\d+$`));
    expect(data.downloadUrl).toBe(
      `/files/jobs/${videoId}/video.mp4?download=dailies-${videoId.slice(0, 8)}.mp4`,
    );
    expect(data.canApprove).toBe(true);
    expect(data.posts.map((post) => post.network)).toEqual([
      'youtube',
      'tiktok',
      'instagram',
      'facebook',
    ]);
    expect(data.reviewRounds).toMatchObject([{ round: 0 }]);
    expect(data.reviewRounds[0]!.verdicts.map((verdict) => verdict.focus)).toEqual([
      'art',
      'rhythm',
      'fidelity',
    ]);
    expect(data.frames).toHaveLength(4);
    expect(data.costs.map((cost) => cost.stage)).toEqual([
      'prepare',
      'ideas',
      'committee',
      'script',
      'direction',
      'produce',
      'review',
      'social',
    ]);
    expect(data.briefing?.summary).toBeTruthy();
    expect(data.script?.lines.length).toBeGreaterThanOrEqual(3);
    expect(data.ideas.some((idea) => idea.status === 'chosen')).toBe(true);
    expect(data.live).toBe(false);
    expect((await loadReviewQueue(db)).videos.map((video) => video.id)).toEqual([videoId]);
  });

  it('approves: ready to post, out of the review queue', async () => {
    const panel = testPanel(db, dataDir);
    const { videoId } = await readyVideo(panel);
    expect(await approve(panel, videoId, t)).toEqual({
      status: 'ok',
      message: 'Approved: ready to post. Download it and copy the texts.',
    });
    expect((await loadVideo(db, videoId)).video.status).toBe('approved');
    expect((await loadReviewQueue(db)).videos).toEqual([]);
  });

  it('refuses to approve a video without a render', async () => {
    const panel = testPanel(db, dataDir);
    const line = await createLine(panel.ctx, productLineInput());
    const video = await db.video.create({
      data: { lineId: line.id, status: 'needs_you', stage: 'review' },
    });
    expect((await loadVideo(db, video.id)).canApprove).toBe(false);
    await expect(approve(panel, video.id, t)).rejects.toThrow('has no finished video to approve');
  });

  it('rejects with redo to a stage Hugo picks, or learn only into a rule', async () => {
    const panel = testPanel(db, dataDir);
    const first = await readyVideo(panel);
    const redo = await reject(
      panel,
      first.videoId,
      formOf({ reason: 'The price shows too late', mode: 'redo', targetStage: 'script' }),
      t,
    );
    expect(redo).toEqual({
      status: 'ok',
      message: 'Sent back to Script (round 1); the worker redoes it.',
    });
    expect(panel.ctx.queue.jobs).toEqual([{ stage: 'script', videoId: first.videoId }]);
    await drain(panel.ctx, STAGE_HANDLERS);

    const learned = await reject(
      panel,
      first.videoId,
      formOf({ reason: 'Never use red text', mode: 'learn', targetStage: 'script' }),
      t,
    );
    expect(learned.status).toBe('ok');
    expect((await listRules(db, first.lineId)).map((rule) => rule.sourceVideoId)).toEqual([
      first.videoId,
    ]);
    const decisions = (await loadVideo(db, first.videoId)).decisions;
    expect(decisions.map((decision) => [decision.mode, decision.targetStage])).toEqual([
      ['redo', 'script'],
      ['learn', null],
    ]);
  });

  it('reads the reject form: a target stage only goes with redo', () => {
    expect(
      rejectInputFromForm(formOf({ reason: 'x y z', mode: 'learn', targetStage: 'produce' })),
    ).toEqual({
      reason: 'x y z',
      mode: 'learn',
    });
    expect(rejectInputFromForm(formOf({ reason: 'x y z', mode: 'redo', targetStage: '' }))).toEqual(
      {
        reason: 'x y z',
        mode: 'redo',
      },
    );
  });

  it('lists all videos with a status filter, marking the waiting ones', async () => {
    const panel = testPanel(db, dataDir);
    const line = await createLine(panel.ctx, productLineInput());
    await db.video.create({ data: { lineId: line.id, status: 'failed', failureKind: 'credit' } });
    await db.video.create({
      data: { lineId: line.id, status: 'failed', failureKind: 'interrupted' },
    });
    await db.video.create({ data: { lineId: line.id, status: 'approved' } });
    const failed = await loadAllVideos(db, 'failed');
    expect(failed.videos.map((video) => video.waiting).sort()).toEqual([false, true]);
    expect((await loadAllVideos(db)).videos).toHaveLength(3);
  });
});
