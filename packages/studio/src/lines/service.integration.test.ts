import fs from 'node:fs/promises';
import path from 'node:path';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LOGO_SVG, productLineInput, tempDataDir, topicLineInput } from '../../test/fixtures';
import {
  createLine,
  getLine,
  listLines,
  listRules,
  setLineActive,
  setRuleActive,
  updateLine,
} from './service';

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

describe('line service', () => {
  it('creates a line, copies its logo into the assets and lists it', async () => {
    const line = await createLine({ db, dataDir }, productLineInput(), { logoFile: LOGO_SVG });
    expect(line.brand.logo).toBe(`lines/${line.id}/logo.svg`);
    await expect(
      fs.access(path.join(dataDir, 'assets', line.brand.logo!)),
    ).resolves.toBeUndefined();
    expect((await listLines(db)).map((each) => each.id)).toEqual([line.id]);
    expect(await getLine(db, line.id)).toEqual(line);
  });

  it('uses the settings default hour when the line has none', async () => {
    const { hour: _hour, ...input } = topicLineInput();
    expect((await createLine({ db, dataDir }, input)).hour).toBe(9);
  });

  it('explains what is wrong with the input, one problem per line', async () => {
    await expect(
      createLine({ db, dataDir }, productLineInput({ perDay: 0, musicTrack: 'music/none.mp3' })),
    ).rejects.toThrow('Invalid line:\n- perDay:');
    await expect(
      createLine({ db, dataDir }, productLineInput({ musicTrack: 'music/none.mp3' })),
    ).rejects.toThrow('Music track "music/none.mp3" was not found');
  });

  it('updates some fields and keeps the others', async () => {
    const line = await createLine({ db, dataDir }, topicLineInput());
    const updated = await updateLine({ db, dataDir }, line.id, { perDay: 2, tone: 'calm' });
    expect(updated).toMatchObject({ perDay: 2, tone: 'calm', name: line.name, kind: 'topic' });
    await expect(
      updateLine({ db, dataDir }, line.id, { material: { select: 'all' } }),
    ).rejects.toThrow('Invalid line');
  });

  it('pauses and resumes, and resuming clears the reason the system paused it for', async () => {
    const line = await createLine({ db, dataDir }, topicLineInput());
    await db.productionLine.update({
      where: { id: line.id },
      data: { active: false, pausedReason: 'budget', warning: 'x' },
    });
    expect(await setLineActive(db, line.id, true)).toMatchObject({
      active: true,
      pausedReason: null,
      warning: null,
    });
    expect((await setLineActive(db, line.id, false)).active).toBe(false);
  });

  it('lists the learned rules and turns one off', async () => {
    const line = await createLine({ db, dataDir }, topicLineInput());
    const rule = await db.learnedRule.create({
      data: { lineId: line.id, text: 'Never show the price first' },
    });
    expect((await listRules(db, line.id)).map((each) => each.text)).toEqual([
      'Never show the price first',
    ]);
    expect((await setRuleActive(db, rule.id, false)).active).toBe(false);
    await expect(setRuleActive(db, 'nope', false)).rejects.toThrow('No learned rule with id nope');
  });

  it('answers a clear message for an unknown or malformed id', async () => {
    await expect(getLine(db, 'abc')).rejects.toThrow('No production line with id abc');
  });
});
