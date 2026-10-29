import 'server-only';
import { resumeStudio, retryVideo } from '@dailies-crew/studio';
import type { Dictionary } from '../../i18n/dictionary';
import { fill } from '../../i18n/locale';
import type { Panel } from '../panel';
import { done } from './result';
import type { ActionState } from './state';

/** Schedules follow the lines; a failed sync must not look like a failed save */
export async function syncQuietly(panel: Panel): Promise<boolean> {
  try {
    await panel.syncSchedules();
    return true;
  } catch (error) {
    panel.ctx.log(`[panel] the schedules could not be updated: ${String(error)}`);
    return false;
  }
}

/** The banner's "Resume": the same as "crew resume" (warning cleared, lines on, videos queued) */
export async function resumeAll(panel: Panel, t: Dictionary): Promise<ActionState> {
  const result = await resumeStudio(panel.ctx);
  await syncQuietly(panel);
  return done(fill(t.shell.resumed, result));
}

/** "Try again" on a failed video: its stage is queued again */
export async function retry(panel: Panel, videoId: string, t: Dictionary): Promise<ActionState> {
  const video = await retryVideo(panel.ctx, videoId);
  return done(fill(t.today.queuedAgain, { stage: t.stages[video.stage] }));
}
