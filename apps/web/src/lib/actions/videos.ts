import 'server-only';
import { approveVideo, type RejectInput, rejectVideo } from '@dailies-crew/studio';
import type { Dictionary } from '../../i18n/dictionary';
import { fill } from '../../i18n/locale';
import { text } from '../forms/read';
import type { Panel } from '../panel';
import { done } from './result';
import type { ActionState } from './state';

export async function approve(panel: Panel, videoId: string, t: Dictionary): Promise<ActionState> {
  await approveVideo(panel.ctx, videoId);
  return done(t.videos.approved);
}

/** The reject form: reason, "redo" or "learn", and for redo an optional stage */
export function rejectInputFromForm(form: FormData): RejectInput {
  const mode = text(form, 'mode') as RejectInput['mode'];
  const target = text(form, 'targetStage');
  return {
    reason: text(form, 'reason'),
    mode,
    ...(mode === 'redo' && target ? { targetStage: target as RejectInput['targetStage'] } : {}),
  };
}

export async function reject(
  panel: Panel,
  videoId: string,
  form: FormData,
  t: Dictionary,
): Promise<ActionState> {
  const result = await rejectVideo(panel.ctx, videoId, rejectInputFromForm(form));
  if (result.stage) {
    return done(
      fill(t.videos.rejectedRedo, { stage: t.stages[result.stage], round: result.video.round }),
    );
  }
  return done(fill(t.videos.rejectedLearn, { rule: result.rule ?? '' }));
}
