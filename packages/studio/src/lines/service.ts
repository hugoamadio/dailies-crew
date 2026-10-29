import type { Db, LearnedRule, ProductionLine } from '@dailies-crew/db';
import { ensureAsset, imageExtension, importAsset, isUuid } from '../assets';
import { parseInput, StudioError } from '../errors';
import { getSettings } from '../settings/service';
import { type Line, type LineData, LineInputSchema, LinePatchSchema } from './schema';

export interface LineFiles {
  /** A logo image anywhere on disk: copied to data/assets/lines/<lineId>/logo.<ext> */
  logoFile?: string;
}

function toLine(row: ProductionLine): Line {
  const data = LineInputSchema.parse({
    kind: row.kind,
    name: row.name,
    material: row.material,
    perDay: row.perDay,
    hour: row.hour,
    language: row.language,
    objective: row.objective,
    audience: row.audience,
    tone: row.tone,
    brand: row.brand,
    voice: { provider: row.voiceProvider, voiceId: row.voiceId },
    musicTrack: row.musicTrack,
    monthlyCapUsd: row.monthlyCapUsd,
    active: row.active,
  });
  return {
    ...data,
    id: row.id,
    hour: row.hour,
    pausedReason: row.pausedReason,
    warning: row.warning,
  };
}

function columns(data: LineData) {
  return {
    name: data.name,
    kind: data.kind,
    material: data.material,
    perDay: data.perDay,
    language: data.language,
    objective: data.objective,
    audience: data.audience,
    tone: data.tone,
    brand: data.brand,
    voiceProvider: data.voice.provider,
    voiceId: data.voice.voiceId,
    musicTrack: data.musicTrack,
    monthlyCapUsd: data.monthlyCapUsd,
    active: data.active,
  };
}

/** The files and products a line points to must exist before it is saved */
async function checkReferences(db: Db, dataDir: string, data: LineData, logoComing: boolean) {
  if (data.brand.logo && !logoComing) await ensureAsset(dataDir, data.brand.logo, 'Brand logo');
  if (data.musicTrack) await ensureAsset(dataDir, data.musicTrack, 'Music track');
  if (data.kind === 'brand') {
    for (const image of data.material.images) await ensureAsset(dataDir, image, 'Brand image');
  }
  if (data.kind === 'product' && data.material.select === 'chosen') {
    const ids = data.material.productIds;
    const found = await db.product.count({ where: { id: { in: ids } } });
    if (found !== new Set(ids).size) throw new StudioError('Some chosen products do not exist');
  }
}

async function withLogo(dataDir: string, lineId: string, data: LineData, files: LineFiles) {
  if (!files.logoFile) return data.brand;
  const logo = `lines/${lineId}/logo.${imageExtension(files.logoFile)}`;
  await importAsset(dataDir, files.logoFile, logo);
  return { ...data.brand, logo };
}

export async function createLine(
  ctx: { db: Db; dataDir: string },
  input: unknown,
  files: LineFiles = {},
): Promise<Line> {
  const data = parseInput(LineInputSchema, input, 'line');
  if (files.logoFile) imageExtension(files.logoFile);
  await checkReferences(ctx.db, ctx.dataDir, data, Boolean(files.logoFile));
  const settings = await getSettings(ctx.db);
  return ctx.db.$transaction(async (tx) => {
    const row = await tx.productionLine.create({
      data: { ...columns(data), hour: data.hour ?? settings.defaultHour },
    });
    if (!files.logoFile) return toLine(row);
    const brand = await withLogo(ctx.dataDir, row.id, data, files);
    return toLine(await tx.productionLine.update({ where: { id: row.id }, data: { brand } }));
  });
}

export async function getLine(db: Db, id: string): Promise<Line> {
  const row = isUuid(id) ? await db.productionLine.findUnique({ where: { id } }) : null;
  if (!row) throw new StudioError(`No production line with id ${id}`);
  return toLine(row);
}

export async function listLines(db: Db): Promise<Line[]> {
  const rows = await db.productionLine.findMany({ orderBy: { createdAt: 'asc' } });
  return rows.map(toLine);
}

/** Changes the given fields; the kind never changes and a new material must fit it */
export async function updateLine(
  ctx: { db: Db; dataDir: string },
  id: string,
  patch: unknown,
  files: LineFiles = {},
): Promise<Line> {
  const changes = parseInput(LinePatchSchema, patch, 'line changes');
  const current = await getLine(ctx.db, id);
  const { id: _id, pausedReason: _paused, warning: _warning, ...currentData } = current;
  const merged = Object.fromEntries(
    Object.entries({ ...currentData, ...changes }).filter(([, value]) => value !== undefined),
  );
  const data = parseInput(LineInputSchema, merged, 'line');
  if (files.logoFile) imageExtension(files.logoFile);
  await checkReferences(ctx.db, ctx.dataDir, data, Boolean(files.logoFile));
  const brand = await withLogo(ctx.dataDir, id, data, files);
  const row = await ctx.db.productionLine.update({
    where: { id },
    data: { ...columns(data), brand, hour: data.hour ?? current.hour },
  });
  return toLine(row);
}

/** Hugo pauses or resumes a line; either way the reason the system paused it for is cleared */
export async function setLineActive(db: Db, id: string, active: boolean): Promise<Line> {
  await getLine(db, id);
  const row = await db.productionLine.update({
    where: { id },
    // Hugo's own pause carries no reason: only the system's pauses (cap) come back by themselves
    data: active ? { active, pausedReason: null, warning: null } : { active, pausedReason: null },
  });
  return toLine(row);
}

/** The system stops a line (spending cap, API key) and says why */
export async function pauseLine(db: Db, id: string, reason: string): Promise<void> {
  // only a line that is on: Hugo's own pause must not gain a reason (it would come back by itself)
  await db.productionLine.updateMany({
    where: { id, active: true },
    data: { active: false, pausedReason: reason },
  });
}

/** The line's learned rules, oldest first (the active ones go into every prompt) */
export async function listRules(db: Db, lineId: string): Promise<LearnedRule[]> {
  await getLine(db, lineId);
  return db.learnedRule.findMany({ where: { lineId }, orderBy: { createdAt: 'asc' } });
}

/** Turns a learned rule off (or on again): the history keeps it */
export async function setRuleActive(db: Db, ruleId: string, active: boolean): Promise<LearnedRule> {
  const rule = isUuid(ruleId) ? await db.learnedRule.findUnique({ where: { id: ruleId } }) : null;
  if (!rule) throw new StudioError(`No learned rule with id ${ruleId}`);
  return db.learnedRule.update({ where: { id: ruleId }, data: { active } });
}
