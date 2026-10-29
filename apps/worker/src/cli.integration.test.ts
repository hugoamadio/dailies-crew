import fs from 'node:fs/promises';
import path from 'node:path';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LAMP_SVG,
  LOGO_SVG,
  productInput,
  productLineInput,
  tempDataDir,
} from '../../../packages/studio/test/fixtures';
import { testContext } from '../../../packages/studio/test/studio';
import { runCli } from './cli';
import type { Runtime } from './runtime';

const db = testDb();
let dataDir: string;
let ctx: ReturnType<typeof testContext>;
beforeEach(async () => {
  await resetDb(db);
  dataDir = await tempDataDir();
  ctx = testContext(db, dataDir);
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});
afterAll(async () => {
  await db.$disconnect();
});

async function crew(
  argv: string[],
  env: Record<string, string | undefined> = {},
  boss: Runtime['boss'] = null,
) {
  const out: string[] = [];
  const err: string[] = [];
  const runtime: Runtime = { ctx, db, boss, close: async () => undefined };
  const code = await runCli(
    argv,
    { out: (line) => out.push(line), err: (line) => err.push(line) },
    env,
    async () => runtime,
  );
  return { code, out: out.join('\n'), err: err.join('\n') };
}

async function writeJson(name: string, value: unknown): Promise<string> {
  const file = path.join(dataDir, name);
  await fs.writeFile(file, JSON.stringify(value));
  return file;
}

describe('the crew CLI', () => {
  it('adds a line and a product, makes a video now, and shows the status', async () => {
    const lineFile = await writeJson('line.json', productLineInput());
    const added = await crew(['line:add', '--file', lineFile, '--logo', LOGO_SVG]);
    expect(added.code).toBe(0);
    const lineId = /Line created: (\S+)/.exec(added.out)![1]!;

    const productFile = await writeJson('product.json', productInput());
    expect((await crew(['product:add', '--file', productFile, '--image', LAMP_SVG])).out).toMatch(
      /^Product created: \S+ "Luminária Lua" \(1 images\)$/,
    );

    const made = await crew(['run-now', '--line', lineId, '--count', '1']);
    expect(made.out).toContain('1 videos queued');
    expect(ctx.queue.jobs).toHaveLength(1);

    const status = await crew(['status']);
    expect(status.out).toContain('- Store products: 0.0000 USD of 10 USD, every day at 9h');
    expect(status.out).toContain('Videos: queued 1');
    expect((await crew(['line:list'])).out).toContain(`${lineId}  on   Store products`);
  });

  it('approves and rejects, and shows the history of a video', async () => {
    const line = await db.productionLine.create({
      data: {
        name: 'L',
        kind: 'topic',
        material: { subject: 'Tips for 3D printing' },
        perDay: 1,
        hour: 9,
        language: 'pt-BR',
        objective: 'teach',
        audience: 'makers',
        tone: 'calm',
        brand: productLineInput().brand,
        voiceProvider: 'fake',
        voiceId: 'demo',
        monthlyCapUsd: 10,
      },
    });
    const ready = {
      lineId: line.id,
      status: 'ready_for_review' as const,
      stage: 'social' as const,
      videoFile: 'jobs/a/video.mp4',
      briefing: { summary: 'x' },
      script: { lines: [] },
      plan: { version: 1 },
    };
    const first = await db.video.create({ data: ready });
    const second = await db.video.create({ data: ready });

    expect((await crew(['approve', first.id])).out).toContain(
      `ready to post: ${path.join(dataDir, 'jobs/a/video.mp4')}`,
    );
    const rejected = await crew([
      'reject',
      second.id,
      '--reason',
      'Legenda pequena',
      '--mode',
      'redo',
      '--stage',
      'direction',
    ]);
    expect(rejected.out).toBe('Sent back to direction (round 1); the worker redoes it.');
    const shown = await crew(['show', second.id]);
    expect(shown.out).toContain('Decision: reject (redo → direction): Legenda pequena');
    expect((await crew(['approve', second.id])).err).toContain('is running');
  });

  it('shows the post texts of a video with each network description, and resumes a line with its waiting videos', async () => {
    const line = await db.productionLine.create({
      data: {
        name: 'L',
        kind: 'topic',
        material: { subject: 'Tips for 3D printing' },
        perDay: 1,
        hour: 9,
        language: 'pt-BR',
        objective: 'teach',
        audience: 'makers',
        tone: 'calm',
        brand: productLineInput().brand,
        voiceProvider: 'fake',
        voiceId: 'demo',
        monthlyCapUsd: 10,
        active: false,
        pausedReason: 'reached its monthly cap',
      },
    });
    const post = { title: 'T', description: 'A long description', hashtags: ['#a'] };
    const video = await db.video.create({
      data: {
        lineId: line.id,
        status: 'paused_budget',
        stage: 'script',
        social: { youtube: post, tiktok: post, instagram: post, facebook: post },
      },
    });
    expect((await crew(['show', video.id])).out).toContain('  A long description');
    const resumed = await crew(['line:resume', line.id]);
    expect(resumed.out).toContain('1 videos that waited for the cap were queued again.');
    expect((await db.video.findUniqueOrThrow({ where: { id: video.id } })).status).toBe('queued');
    expect(ctx.queue.jobs).toEqual([{ stage: 'script', videoId: video.id }]);
  });

  it('changes the settings and reports the keys without showing them', async () => {
    const file = await writeJson('settings.json', { globalMonthlyCapUsd: 25 });
    expect((await crew(['settings:set', '--file', file])).out).toBe('Settings saved.');
    const shown = await crew(['settings'], { ANTHROPIC_API_KEY: 'sk-ant-secret' });
    expect(shown.out).toContain('"globalMonthlyCapUsd": 25');
    expect(shown.out).toContain('ANTHROPIC_API_KEY: configured');
    expect(shown.out).toContain('ELEVENLABS_API_KEY: missing');
    expect(shown.out).not.toContain('sk-ant-secret');
  });

  it('moves the daily runs when the settings change', async () => {
    const lineFile = await writeJson('line.json', productLineInput());
    await crew(['line:add', '--file', lineFile, '--logo', LOGO_SVG]);
    const schedules: { cron: string; tz: string | undefined }[] = [];
    const boss = {
      schedule: async (_queue: string, cron: string, _data: unknown, options: { tz?: string }) => {
        schedules.push({ cron, tz: options.tz });
      },
      getSchedules: async () => [],
      unschedule: async () => undefined,
    } as unknown as NonNullable<Runtime['boss']>;
    const file = await writeJson('settings.json', { timezone: 'America/New_York' });
    const saved = await crew(['settings:set', '--file', file], {}, boss);
    expect(saved.out).toBe(
      'Settings saved.\nSchedules updated: 1 lines (active, or paused by the budget).',
    );
    expect(schedules).toEqual([{ cron: '0 9 * * *', tz: 'America/New_York' }]);
  });

  it('turns a learned rule off and on again', async () => {
    const line = await db.productionLine.create({
      data: {
        name: 'L',
        kind: 'topic',
        material: { subject: 'Tips' },
        perDay: 1,
        hour: 9,
        language: 'pt-BR',
        objective: 'teach',
        audience: 'makers',
        tone: 'calm',
        brand: productLineInput().brand,
        voiceProvider: 'fake',
        voiceId: 'demo',
        monthlyCapUsd: 10,
      },
    });
    const rule = await db.learnedRule.create({ data: { lineId: line.id, text: 'No long intros' } });
    expect((await crew(['rule:off', rule.id])).out).toBe('Rule off: No long intros');
    expect((await db.learnedRule.findUniqueOrThrow({ where: { id: rule.id } })).active).toBe(false);
    expect((await crew(['rule:on', rule.id])).out).toBe('Rule on: No long intros');
    expect((await db.learnedRule.findUniqueOrThrow({ where: { id: rule.id } })).active).toBe(true);
  });

  it('explains a bad file and a bad id in one line', async () => {
    expect((await crew(['line:add', '--file', '/nowhere/line.json'])).err).toBe(
      'File not found: /nowhere/line.json',
    );
    expect((await crew(['show', 'abc'])).err).toBe('No video with id abc');
  });
});
