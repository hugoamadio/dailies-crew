import fs from 'node:fs/promises';
import path from 'node:path';
import type { Stage } from '@dailies-crew/db';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tempDataDir, topicLineInput } from '../../test/fixtures';
import { testContext } from '../../test/studio';
import { buildPrepareRequest } from '../crew/preparer';
import { createLine } from '../lines/service';
import { LlmError } from '../llm/errors';
import { getSettings } from '../settings/service';
import type { StageHandler, StageResult } from './handler';
import { json } from './json';
import { runStage } from './runner';
import { STAGES } from './stages';

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

/** Every stage just moves on, except the ones a test replaces */
function handlers(
  overrides: Partial<Record<Stage, StageHandler>> = {},
): Record<Stage, StageHandler> {
  const next: StageHandler = async (_ctx, run) => ({
    outcome: { kind: 'next' },
    output: { stage: run.stage },
  });
  return { ...Object.fromEntries(STAGES.map((stage) => [stage, next])), ...overrides } as Record<
    Stage,
    StageHandler
  >;
}

/** A prepare stage that really calls the (fake) preparer and saves the briefing */
const prepare: StageHandler = async (_ctx, run) => {
  const briefing = await run.call(
    buildPrepareRequest(
      {
        recipe: run.recipe,
        rules: run.rules,
        material: run.material,
        recentIdeas: [],
        rejections: [],
      },
      run.settings.roles.preparer,
    ),
  );
  return {
    outcome: { kind: 'next' },
    input: { asked: 'preparer' },
    output: briefing,
    persist: (tx) =>
      tx.video.update({ where: { id: run.video.id }, data: { briefing: json(briefing) } }),
  };
};

async function topicVideo(data: Record<string, unknown> = {}, line: Record<string, unknown> = {}) {
  const created = await createLine({ db, dataDir }, topicLineInput(line));
  return db.video.create({ data: { lineId: created.id, ...data } });
}

const job = (videoId: string, lastAttempt = false) => ({ videoId, lastAttempt });

describe('runStage', () => {
  it('runs the stage, saves its result with the run, records the cost, and queues the next stage', async () => {
    const ctx = testContext(db, dataDir);
    const video = await topicVideo();
    await runStage(ctx, 'prepare', job(video.id), handlers({ prepare }));

    const run = await db.stageRun.findFirstOrThrow();
    expect(run).toMatchObject({
      stage: 'prepare',
      round: 0,
      attempt: 1,
      status: 'done',
      input: { asked: 'preparer' },
    });
    expect((run.output as { outcome: unknown }).outcome).toEqual({ kind: 'next' });
    expect(await db.video.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({
      status: 'running',
      stage: 'ideas',
      briefing: { keyFacts: ['Tips to get better 3D prints at home'] },
    });
    expect(await db.costEntry.findFirstOrThrow()).toMatchObject({
      stage: 'prepare',
      role: 'preparer',
      model: 'claude-haiku-5-5',
    });
    expect(ctx.queue.jobs).toEqual([{ stage: 'ideas', videoId: video.id }]);
  });

  it('records each voice synthesis as it happens', async () => {
    const ctx = testContext(db, dataDir);
    const video = await topicVideo({ stage: 'produce' });
    const speak: StageHandler = async (_ctx, run) => {
      await run.voice().synthesize({ text: 'Olá mundo', voiceId: 'demo', language: 'pt-BR' });
      return { outcome: { kind: 'next' }, output: {} };
    };
    await runStage(ctx, 'produce', job(video.id), handlers({ produce: speak }));
    expect(await db.costEntry.findFirstOrThrow()).toMatchObject({
      role: 'voice',
      model: 'fake',
      voiceCharacters: 9,
    });
  });

  it('never runs a finished stage again: a repeated job only moves the video on', async () => {
    const ctx = testContext(db, dataDir);
    const video = await topicVideo();
    await runStage(ctx, 'prepare', job(video.id), handlers({ prepare }));
    // as if the worker died after finishing the stage, before moving the video on
    await db.video.update({ where: { id: video.id }, data: { stage: 'prepare' } });
    ctx.queue.jobs.length = 0;
    let ranAgain = false;
    const spy: StageHandler = async (...args) => {
      ranAgain = true;
      return prepare(...args);
    };

    await runStage(ctx, 'prepare', job(video.id), handlers({ prepare: spy }));

    expect(ranAgain).toBe(false);
    expect(ctx.queue.jobs).toEqual([{ stage: 'ideas', videoId: video.id }]);
    expect(await db.stageRun.count()).toBe(1);
    expect(await db.costEntry.count()).toBe(1);
  });

  it('marks an attempt the worker never finished as interrupted, and runs the stage again', async () => {
    const ctx = testContext(db, dataDir);
    const video = await topicVideo({ status: 'running' });
    await db.stageRun.create({
      data: { videoId: video.id, stage: 'prepare', round: 0, attempt: 1, status: 'running' },
    });
    await runStage(ctx, 'prepare', job(video.id), handlers());
    const runs = await db.stageRun.findMany({ orderBy: { attempt: 'asc' } });
    expect(runs.map((run) => [run.attempt, run.status, run.error])).toEqual([
      [1, 'failed', 'interrupted: the worker stopped'],
      [2, 'done', null],
    ]);
  });

  it('ignores a job for a stage the video already left, or for a video that stopped', async () => {
    const ctx = testContext(db, dataDir);
    const moved = await topicVideo({ stage: 'script', status: 'running' });
    const stopped = await topicVideo({ status: 'needs_you' });
    await runStage(ctx, 'prepare', job(moved.id), handlers());
    await runStage(ctx, 'prepare', job(stopped.id), handlers());
    expect(await db.stageRun.count()).toBe(0);
    expect(ctx.logs.at(-1)).toContain('job skipped');
  });

  it('pauses the line and the video at the spending cap, before calling anyone', async () => {
    const ctx = testContext(db, dataDir);
    const video = await topicVideo({}, { monthlyCapUsd: 0 });
    await runStage(ctx, 'prepare', job(video.id), handlers({ prepare }));

    expect(await db.stageRun.count()).toBe(0);
    expect(await db.video.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({
      status: 'paused_budget',
      failureReason:
        'line "3D printing tips" reached its monthly cap of 0.00 USD (0.00 USD spent this month)',
    });
    expect(
      await db.productionLine.findUniqueOrThrow({ where: { id: video.lineId } }),
    ).toMatchObject({
      active: false,
      pausedReason: expect.stringContaining('monthly cap'),
    });
  });

  it('stops every line on a refused key, without using the retries', async () => {
    const ctx = testContext(db, dataDir);
    const video = await topicVideo();
    const other = await createLine({ db, dataDir }, topicLineInput({ name: 'Other line' }));
    const refused: StageHandler = async () => {
      throw new LlmError('auth', 'Claude API (preparer): the API key was refused (401)', false);
    };

    await runStage(ctx, 'prepare', job(video.id), handlers({ prepare: refused }));

    expect(await db.video.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({
      status: 'failed',
      failureKind: 'auth',
    });
    expect((await getSettings(db)).warning).toBe(
      'Claude API (preparer): the API key was refused (401)',
    );
    expect(
      (await db.productionLine.findUniqueOrThrow({ where: { id: other.id } })).pausedReason,
    ).toBe('Claude API (preparer): the API key was refused (401)');
    // the next video waits instead of paying
    const next = await topicVideo();
    await runStage(ctx, 'prepare', job(next.id), handlers({ prepare }));
    expect(await db.video.findUniqueOrThrow({ where: { id: next.id } })).toMatchObject({
      status: 'failed',
      failureKind: 'paused',
    });
  });

  it('lets the queue retry a passing failure, and fails the video on the last attempt', async () => {
    const ctx = testContext(db, dataDir);
    const video = await topicVideo();
    const overloaded = new LlmError(
      'overloaded',
      'Claude API (preparer): the API is unavailable (529)',
      true,
    );
    const busy: StageHandler = async () => {
      throw overloaded;
    };

    await expect(runStage(ctx, 'prepare', job(video.id), handlers({ prepare: busy }))).rejects.toBe(
      overloaded,
    );
    expect((await db.video.findUniqueOrThrow({ where: { id: video.id } })).status).toBe('running');
    await runStage(ctx, 'prepare', job(video.id, true), handlers({ prepare: busy }));

    expect(await db.video.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({
      status: 'failed',
      failureKind: 'overloaded',
      failureReason: 'Claude API (preparer): the API is unavailable (529)',
    });
    const runs = await db.stageRun.findMany({ orderBy: { attempt: 'asc' } });
    expect(runs.map((run) => [run.attempt, run.status])).toEqual([
      [1, 'failed'],
      [2, 'failed'],
    ]);
  });

  it('starts a new round on a rework, and forgets the voice when it starts at produce', async () => {
    const ctx = testContext(db, dataDir);
    const video = await topicVideo({ stage: 'review', status: 'running' });
    const voiceCache = path.join(dataDir, 'jobs', video.id, 'voice-cache.json');
    await fs.mkdir(path.dirname(voiceCache), { recursive: true });
    await fs.writeFile(voiceCache, '{}');
    const instructions = [
      { stage: 'produce', instruction: 'The voice is robotic', source: 'review' },
    ];
    const rework: StageHandler = async (): Promise<StageResult> => ({
      outcome: {
        kind: 'rework',
        from: 'produce',
        instructions: [{ stage: 'produce', instruction: 'The voice is robotic', source: 'review' }],
      },
      output: {},
    });

    await runStage(ctx, 'review', job(video.id), handlers({ review: rework }));

    expect(await db.video.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({
      stage: 'produce',
      round: 1,
      reviewRounds: 1,
      instructions,
    });
    expect(ctx.queue.jobs).toEqual([{ stage: 'produce', videoId: video.id }]);
    await expect(fs.access(voiceCache)).rejects.toThrow();
  });

  it('forgets the voice when a rework from an earlier stage also asks for a new take', async () => {
    const ctx = testContext(db, dataDir);
    async function reworkFromScript(items: { stage: string; instruction: string }[]) {
      const video = await topicVideo({ stage: 'review', status: 'running' });
      const voiceCache = path.join(dataDir, 'jobs', video.id, 'voice-cache.json');
      await fs.mkdir(path.join(path.dirname(voiceCache), 'voice-cache'), { recursive: true });
      await fs.writeFile(voiceCache, '{}');
      const rework: StageHandler = async (): Promise<StageResult> => ({
        outcome: {
          kind: 'rework',
          from: 'script',
          instructions: items.map((item) => ({ ...item, source: 'review' })) as never,
        },
        output: {},
      });
      await runStage(ctx, 'review', job(video.id), handlers({ review: rework }));
      expect(await db.video.findUniqueOrThrow({ where: { id: video.id } })).toMatchObject({
        stage: 'script',
        round: 1,
      });
      return { voiceCache, folder: path.join(path.dirname(voiceCache), 'voice-cache') };
    }

    const asked = await reworkFromScript([
      { stage: 'script', instruction: 'The hook is weak' },
      { stage: 'produce', instruction: 'The voice is robotic' },
    ]);
    await expect(fs.access(asked.voiceCache)).rejects.toThrow();
    await expect(fs.access(asked.folder)).rejects.toThrow();

    const kept = await reworkFromScript([{ stage: 'script', instruction: 'The hook is weak' }]);
    await expect(fs.access(kept.voiceCache)).resolves.toBeUndefined();
    await expect(fs.access(kept.folder)).resolves.toBeUndefined();
  });

  it('makes the video ready for review after the last stage, or hands it to Hugo with the problems', async () => {
    const ctx = testContext(db, dataDir);
    const last = await topicVideo({ stage: 'social', status: 'running' });
    await runStage(ctx, 'social', job(last.id), handlers());
    expect((await db.video.findUniqueOrThrow({ where: { id: last.id } })).status).toBe(
      'ready_for_review',
    );

    const stuck = await topicVideo({ stage: 'direction', status: 'running' });
    const giveUp: StageHandler = async () => ({
      outcome: { kind: 'needs_you', problems: ['No valid plan'] },
      output: {},
    });
    await runStage(ctx, 'direction', job(stuck.id), handlers({ direction: giveUp }));
    expect(await db.video.findUniqueOrThrow({ where: { id: stuck.id } })).toMatchObject({
      status: 'needs_you',
      problems: ['No valid plan'],
    });
    expect(ctx.queue.jobs).toEqual([]);
  });
});
