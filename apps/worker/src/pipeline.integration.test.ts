import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resetDb, testDb } from '@dailies-crew/db/test';
import {
  approveVideo,
  createLine,
  createProduct,
  runLineTick,
  STAGE_HANDLERS,
  STAGES,
  startWorkers,
} from '@dailies-crew/studio';
import { getVideoMetadata } from '@remotion/renderer';
import { afterAll, describe, expect, inject, it } from 'vitest';
import {
  LAMP_SVG,
  LOGO_SVG,
  productInput,
  productLineInput,
  tempDataDir,
} from '../../../packages/studio/test/fixtures';
import { createRuntime } from './runtime';

const db = testDb();
afterAll(async () => {
  await db.$disconnect();
});

async function settled(videoId: string, timeoutMs: number) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const video = await db.video.findUniqueOrThrow({ where: { id: videoId } });
    if (!['queued', 'running'].includes(video.status)) return video;
    if (Date.now() > until) throw new Error(`video still ${video.status} at ${video.stage}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

describe('the studio end to end (fake AI, fake voice, real render)', () => {
  it('goes from run-now to ready for review through the queue, then is approved', async () => {
    await resetDb(db);
    await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS pgboss_e2e CASCADE');
    const dataDir = await tempDataDir();
    const logs: string[] = [];
    const runtime = await createRuntime(
      { DATABASE_URL: inject('testDatabaseUrl'), DAILIES_FAKE_AI: '1', DAILIES_DATA_DIR: dataDir },
      { queue: true, worker: true, bossSchema: 'pgboss_e2e', log: (line) => logs.push(line) },
    );
    try {
      const line = await createLine(runtime.ctx, productLineInput(), { logoFile: LOGO_SVG });
      await createProduct(runtime.ctx, productInput(), [LAMP_SVG]);
      await startWorkers(runtime.boss!, runtime.ctx, STAGE_HANDLERS);

      const { created } = await runLineTick(runtime.ctx, line.id, { count: 1 });
      const video = await settled(created[0]!, 600_000);

      expect(video.status, logs.join('\n')).toBe('ready_for_review');
      const runs = await db.stageRun.findMany({
        where: { videoId: video.id },
        orderBy: { startedAt: 'asc' },
      });
      expect(runs.map((run) => [run.stage, run.status])).toEqual(
        STAGES.map((stage) => [stage, 'done']),
      );
      const costs = await db.costEntry.findMany({ where: { videoId: video.id } });
      expect(costs.length).toBeGreaterThanOrEqual(14);
      expect(costs.every((cost) => cost.usd === 0)).toBe(true);

      const file = path.join(dataDir, video.videoFile!);
      const metadata = await getVideoMetadata(file);
      expect([metadata.width, metadata.height]).toEqual([1080, 1920]);
      expect(metadata.durationInSeconds).toBeGreaterThanOrEqual(15);
      expect(video.frameFiles.length).toBeGreaterThanOrEqual(30);
      expect(video.frameFiles.every((frame) => existsSync(path.join(dataDir, frame)))).toBe(true);
      expect(existsSync(path.join(dataDir, 'jobs', video.id, 'bundle'))).toBe(false);
      expect(video.social).toMatchObject({ youtube: { title: expect.any(String) } });

      expect((await approveVideo(runtime.ctx, video.id)).status).toBe('approved');
    } finally {
      await runtime.close();
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  }, 900_000);
});
