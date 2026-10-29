import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Db } from '@dailies-crew/db';
import { AUDIO_EXTENSIONS, FONT_NAMES, isSafeRelativePath } from '@dailies-crew/plan';
import {
  assetsDir,
  getLine,
  getSettings,
  listLines,
  listProducts,
  listRules,
  studioStatus,
} from '@dailies-crew/studio';
import { categoriesOf } from './categories';

export type LineState = 'on' | 'pausedByYou' | 'pausedCap' | 'stopped';

/**
 * Hugo's pause has no reason and stays; the system's pause comes back by itself next month (a
 * cap), or with "Resume" when it stopped everything (a refused key or no credit).
 */
export function lineState(
  line: { active: boolean; pausedReason: string | null },
  globalWarning: string | null,
): LineState {
  if (line.active) return 'on';
  if (!line.pausedReason) return 'pausedByYou';
  return globalWarning && line.pausedReason === globalWarning ? 'stopped' : 'pausedCap';
}

/** "All lines": each line with its state and this month's spending */
export async function loadLines(db: Db, now: Date) {
  const [status, lines, settings] = await Promise.all([
    studioStatus(db, now),
    listLines(db),
    getSettings(db),
  ]);
  const spend = new Map(status.lines.map((line) => [line.id, line.monthSpend]));
  return {
    timezone: settings.timezone,
    lines: lines.map((line) => ({
      ...line,
      monthSpend: spend.get(line.id) ?? 0,
      state: lineState(line, status.warning),
    })),
  };
}

/** Music files a line can use: data/assets/music/<file> with an audio extension */
export async function musicTracks(dataDir: string): Promise<string[]> {
  const files = await fs.readdir(path.join(assetsDir(dataDir), 'music')).catch(() => []);
  return files
    .map((file) => `music/${file}`)
    .filter(
      (track) =>
        isSafeRelativePath(track) &&
        (AUDIO_EXTENSIONS as readonly string[]).includes(
          path.extname(track).slice(1).toLowerCase(),
        ),
    )
    .sort();
}

/** What the line form offers (products, categories, music, fonts), and the line to edit */
export async function loadLineForm(db: Db, dataDir: string, id?: string) {
  const [settings, products, music] = await Promise.all([
    getSettings(db),
    listProducts(db),
    musicTracks(dataDir),
  ]);
  const line = id ? await getLine(db, id) : null;
  return {
    defaultHour: settings.defaultHour,
    timezone: settings.timezone,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      active: product.active,
    })),
    categories: categoriesOf(products),
    music,
    fonts: [...FONT_NAMES],
    line,
    rules: line ? await listRules(db, line.id) : [],
  };
}
