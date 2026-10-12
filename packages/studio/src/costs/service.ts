import type { Db, Stage } from '@dailies-crew/db';
import type { RoleName } from '../roles';
import type { StudioSettings } from '../settings/schema';
import {
  type BudgetVerdict,
  budgetVerdict,
  llmUsd,
  priceFor,
  roundUsd,
  type TokenUsage,
  voiceUsd,
} from './math';
import { monthStart } from './month';

export interface LlmCostInput {
  lineId: string;
  videoId: string | null;
  stage: Stage | null;
  role: RoleName;
  requestedModel: string;
  /** The model that answered (a server-side fallback may answer with another one) */
  model: string;
  usage: TokenUsage;
}

/** Writes one CostEntry (and adds it to the video's total); returns the cost in USD */
export async function recordLlmCost(
  db: Db,
  settings: StudioSettings,
  input: LlmCostInput,
): Promise<number> {
  const usd = llmUsd(input.usage, priceFor(settings.prices, input.model, input.requestedModel));
  await db.$transaction([
    db.costEntry.create({
      data: {
        lineId: input.lineId,
        videoId: input.videoId,
        stage: input.stage,
        role: input.role,
        model: input.model,
        ...input.usage,
        usd,
      },
    }),
    ...(input.videoId
      ? [db.video.update({ where: { id: input.videoId }, data: { costUsd: { increment: usd } } })]
      : []),
  ]);
  return usd;
}

export interface VoiceCostInput {
  lineId: string;
  videoId: string;
  provider: 'elevenlabs' | 'fake';
  characters: number;
}

export async function recordVoiceCost(
  db: Db,
  settings: StudioSettings,
  input: VoiceCostInput,
): Promise<number> {
  const usd = voiceUsd(input.characters, settings.prices.voicePer1kChars[input.provider]);
  await db.$transaction([
    db.costEntry.create({
      data: {
        lineId: input.lineId,
        videoId: input.videoId,
        stage: 'produce',
        role: 'voice',
        model: input.provider,
        voiceCharacters: input.characters,
        usd,
      },
    }),
    db.video.update({ where: { id: input.videoId }, data: { costUsd: { increment: usd } } }),
  ]);
  return usd;
}

/** USD spent from `since` (inclusive) to `until` (exclusive), for one line or for all */
export async function spendBetween(
  db: Db,
  range: { since: Date; until?: Date; lineId?: string },
): Promise<number> {
  const result = await db.costEntry.aggregate({
    _sum: { usd: true },
    where: {
      createdAt: { gte: range.since, ...(range.until ? { lt: range.until } : {}) },
      ...(range.lineId ? { lineId: range.lineId } : {}),
    },
  });
  // each entry is rounded to the micro-dollar; their float sum must be too, or 0.1 + 0.7 < 0.8
  return roundUsd(result._sum.usd ?? 0);
}

/** Compares this month's spending (in the settings' time zone) with the line's and the global cap */
export async function checkBudget(
  db: Db,
  settings: StudioSettings,
  line: { id: string; name: string; monthlyCapUsd: number },
  now: Date,
): Promise<BudgetVerdict> {
  const since = monthStart(now, settings.timezone);
  const [lineSpend, globalSpend] = await Promise.all([
    spendBetween(db, { since, lineId: line.id }),
    spendBetween(db, { since }),
  ]);
  return budgetVerdict({
    lineName: line.name,
    lineSpend,
    lineCap: line.monthlyCapUsd,
    globalSpend,
    globalCap: settings.globalMonthlyCapUsd,
  });
}
