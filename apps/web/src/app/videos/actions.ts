'use server';

import { runAction } from '../../lib/actions/run';
import type { ActionState } from '../../lib/actions/state';
import { approve, reject } from '../../lib/actions/videos';

export async function approveAction(videoId: string): Promise<ActionState> {
  return runAction((panel, t) => approve(panel, videoId, t));
}

export async function rejectAction(
  videoId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction((panel, t) => reject(panel, videoId, form, t));
}
