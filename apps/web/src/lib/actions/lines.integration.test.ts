import fs from 'node:fs/promises';
import path from 'node:path';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { getLine, listRules, StudioError } from '@dailies-crew/studio';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LOGO_SVG, tempDataDir } from '../../../../../packages/studio/test/fixtures';
import { formOf, t, testPanel, upload } from '../../test/panel';
import { loadLineForm, loadLines } from '../loaders/lines';
import {
  createLineFromForm,
  editRule,
  removeRule,
  runLineNow,
  switchLine,
  switchRule,
  updateLineFromForm,
} from './lines';
import { failure } from './result';

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

function lineForm(fields: Record<string, string | string[] | File> = {}) {
  return formOf({
    name: 'Tips',
    kind: 'topic',
    'material.subject': 'Tips to get better 3D prints at home',
    'material.avoid': 'brand names',
    perDay: '2',
    hour: '9',
    language: 'pt-BR',
    objective: 'teach and gain followers',
    audience: 'people who print in 3D at home',
    tone: 'calm',
    'brand.colors.background': '#0f0f14',
    'brand.colors.surface': '#1c1c24',
    'brand.colors.text': '#ffffff',
    'brand.colors.primary': '#7c3aed',
    'brand.colors.accent': '#f59e0b',
    'brand.headingFont': 'Montserrat',
    'brand.bodyFont': 'Inter',
    'brand.personality': 'calm',
    'voice.provider': 'fake',
    'voice.voiceId': 'demo',
    musicTrack: '',
    monthlyCapUsd: '5',
    active: 'on',
    ...fields,
  });
}

describe('line actions', () => {
  it('creates a line with its uploaded logo, syncs the schedules and leaves no upload behind', async () => {
    const panel = testPanel(db, dataDir);
    const { state, id } = await createLineFromForm(
      panel,
      lineForm({ logoFile: await upload(LOGO_SVG) }),
      t,
    );
    expect(state).toEqual({ status: 'ok', message: 'Line saved.' });
    const line = await getLine(db, id);
    expect(line).toMatchObject({ name: 'Tips', kind: 'topic', perDay: 2, active: true });
    expect(line.brand.logo).toBe(`lines/${id}/logo.svg`);
    await expect(
      fs.access(path.join(dataDir, 'assets', line.brand.logo!)),
    ).resolves.toBeUndefined();
    expect(await fs.readdir(path.join(dataDir, 'tmp', 'uploads'))).toEqual([]);
    expect(panel.syncs).toBe(1);
  });

  it('answers each invalid field by its form name', async () => {
    const panel = testPanel(db, dataDir);
    const error = await createLineFromForm(
      panel,
      lineForm({ name: '', 'brand.colors.primary': 'purple', perDay: '11' }),
      t,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StudioError);
    const state = failure(error, 'unexpected');
    expect(state.status === 'error' && Object.keys(state.fields).sort()).toEqual([
      'brand.colors.primary',
      'name',
      'perDay',
    ]);
    expect(panel.syncs).toBe(0);
  });

  it('updates a line and keeps its logo when no new one comes', async () => {
    const panel = testPanel(db, dataDir);
    const { id } = await createLineFromForm(
      panel,
      lineForm({ logoFile: await upload(LOGO_SVG) }),
      t,
    );
    const logo = `lines/${id}/logo.svg`;
    const state = await updateLineFromForm(
      panel,
      id,
      lineForm({ name: 'Better tips', 'brand.logo': logo, hour: '18' }),
      t,
    );
    expect(state.status).toBe('ok');
    expect(await getLine(db, id)).toMatchObject({ name: 'Better tips', hour: 18, brand: { logo } });
  });

  it('pauses and turns a line on like the CLI, queuing the videos that waited for the cap', async () => {
    const panel = testPanel(db, dataDir);
    const { id } = await createLineFromForm(panel, lineForm(), t);
    expect(await switchLine(panel, id, false, t)).toEqual({
      status: 'ok',
      message: 'The line is paused.',
    });
    const waiting = await db.video.create({
      data: { lineId: id, status: 'paused_budget', stage: 'produce' },
    });
    expect(await switchLine(panel, id, true, t)).toEqual({
      status: 'ok',
      message: 'The line is on; 1 videos that waited for the cap were queued again.',
    });
    expect(panel.ctx.queue.jobs).toEqual([{ stage: 'produce', videoId: waiting.id }]);
    expect(panel.syncs).toBe(3);
  });

  it('runs a line now with a count, and refuses a count out of range', async () => {
    const panel = testPanel(db, dataDir);
    const { id } = await createLineFromForm(panel, lineForm(), t);
    expect(await runLineNow(panel, id, formOf({ count: '2' }), t)).toEqual({
      status: 'ok',
      message: '2 videos queued: the worker makes them.',
    });
    expect(panel.ctx.queue.jobs.map((job) => job.stage)).toEqual(['prepare', 'prepare']);
    await expect(runLineNow(panel, id, formOf({ count: '11' }), t)).rejects.toThrow(
      'Choose from 1 to 10 videos.',
    );
  });

  it('edits, switches and deletes a learned rule', async () => {
    const panel = testPanel(db, dataDir);
    const { id } = await createLineFromForm(panel, lineForm(), t);
    const rule = await db.learnedRule.create({ data: { lineId: id, text: 'Never start slow' } });
    await editRule(panel, rule.id, formOf({ text: 'Open with the result' }), t);
    await switchRule(panel, rule.id, false, t);
    expect(await listRules(db, id)).toMatchObject([
      { text: 'Open with the result', active: false },
    ]);
    expect(await removeRule(panel, rule.id, t)).toEqual({ status: 'ok', message: 'Rule deleted.' });
    expect(await listRules(db, id)).toEqual([]);
  });
});

describe('line loaders', () => {
  it('tells a pause by Hugo from a pause for the cap and from a global stop', async () => {
    const panel = testPanel(db, dataDir);
    const ids: string[] = [];
    // one at a time: the first one creates the settings row
    for (const name of ['Mine', 'Cap', 'Stopped', 'On']) {
      ids.push((await createLineFromForm(panel, lineForm({ name }), t)).id);
    }
    await db.productionLine.update({ where: { id: ids[0] }, data: { active: false } });
    await db.productionLine.update({
      where: { id: ids[1] },
      data: { active: false, pausedReason: 'line "Cap" reached its monthly cap' },
    });
    await db.settings.update({ where: { id: 1 }, data: { warning: 'the API key was refused' } });
    await db.productionLine.update({
      where: { id: ids[2] },
      data: { active: false, pausedReason: 'the API key was refused' },
    });
    const { lines } = await loadLines(db, new Date());
    expect(lines.map((line) => [line.name, line.state])).toEqual([
      ['Mine', 'pausedByYou'],
      ['Cap', 'pausedCap'],
      ['Stopped', 'stopped'],
      ['On', 'on'],
    ]);
  });

  it('offers the music files of the data folder and the fonts the scenes know', async () => {
    await fs.mkdir(path.join(dataDir, 'assets', 'music'), { recursive: true });
    for (const file of ['calm.mp3', 'notes.txt', 'beat.wav']) {
      await fs.writeFile(path.join(dataDir, 'assets', 'music', file), 'x');
    }
    const form = await loadLineForm(db, dataDir);
    expect(form.music).toEqual(['music/beat.wav', 'music/calm.mp3']);
    expect(form.fonts).toContain('Inter');
    expect(form.line).toBeNull();
  });
});
