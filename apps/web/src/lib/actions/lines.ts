import 'server-only';
import {
  createLine,
  deleteRule,
  requeueBudgetVideos,
  runLineTick,
  setLineActive,
  setRuleActive,
  StudioError,
  updateLine,
  updateRuleText,
} from '@dailies-crew/studio';
import type { Dictionary } from '../../i18n/dictionary';
import { fill } from '../../i18n/locale';
import { lineFromForm, linePatchFromForm } from '../forms/line';
import { num, text } from '../forms/read';
import type { Panel } from '../panel';
import { filesFrom, withUploads } from '../uploads';
import { done } from './result';
import type { ActionState } from './state';
import { syncQuietly } from './studio';

/** "New line": the line, its logo (uploaded) and the daily schedules, as "crew line:add" */
export async function createLineFromForm(
  panel: Panel,
  form: FormData,
  t: Dictionary,
): Promise<{ state: ActionState; id: string }> {
  const line = await withUploads(panel.ctx.dataDir, filesFrom(form, 'logoFile'), ([logo]) =>
    createLine(panel.ctx, lineFromForm(form), logo ? { logoFile: logo } : {}),
  );
  const synced = await syncQuietly(panel);
  return { state: done(synced ? t.lines.saved : t.lines.savedNoSync), id: line.id };
}

/** The edit page's form, as "crew line:update" */
export async function updateLineFromForm(
  panel: Panel,
  id: string,
  form: FormData,
  t: Dictionary,
): Promise<ActionState> {
  await withUploads(panel.ctx.dataDir, filesFrom(form, 'logoFile'), ([logo]) =>
    updateLine(panel.ctx, id, linePatchFromForm(form), logo ? { logoFile: logo } : {}),
  );
  return done((await syncQuietly(panel)) ? t.lines.saved : t.lines.savedNoSync);
}

/**
 * The on/pause switch, exactly as "crew line:pause" and "crew line:resume": turning a line on
 * also queues again its videos that waited for the spending cap.
 */
export async function switchLine(
  panel: Panel,
  id: string,
  on: boolean,
  t: Dictionary,
): Promise<ActionState> {
  const line = await setLineActive(panel.ctx.db, id, on);
  let message = on ? t.lines.turnedOn : t.lines.paused;
  if (on) {
    const queued = await requeueBudgetVideos(panel.ctx, line.id);
    if (queued > 0) message = fill(t.lines.turnedOnRequeued, { count: queued });
  }
  await syncQuietly(panel);
  return done(message);
}

/** "Run now" with a count, as "crew run-now --count" */
export async function runLineNow(
  panel: Panel,
  id: string,
  form: FormData,
  t: Dictionary,
): Promise<ActionState> {
  const count = num(form, 'count');
  if (count === undefined || !Number.isInteger(count) || count < 1 || count > 10) {
    throw new StudioError(t.lines.runCountInvalid);
  }
  const result = await runLineTick(panel.ctx, id, { count });
  if (result.created.length === 0) {
    throw new StudioError(fill(t.lines.runNowSkipped, { reason: result.skipped ?? '' }));
  }
  return done(fill(t.lines.runNowDone, { count: result.created.length }));
}

export async function editRule(
  panel: Panel,
  ruleId: string,
  form: FormData,
  t: Dictionary,
): Promise<ActionState> {
  await updateRuleText(panel.ctx.db, ruleId, text(form, 'text'));
  return done(t.lines.ruleSaved);
}

export async function switchRule(
  panel: Panel,
  ruleId: string,
  active: boolean,
  t: Dictionary,
): Promise<ActionState> {
  await setRuleActive(panel.ctx.db, ruleId, active);
  return done(t.lines.ruleSaved);
}

export async function removeRule(
  panel: Panel,
  ruleId: string,
  t: Dictionary,
): Promise<ActionState> {
  await deleteRule(panel.ctx.db, ruleId);
  return done(t.lines.ruleDeleted);
}
