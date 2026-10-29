'use server';

import { getPanel } from '../../lib/panel';
import { runAction } from '../../lib/actions/run';
import { saveSettings } from '../../lib/actions/settings';
import type { ActionState } from '../../lib/actions/state';
import { checkKeys, type KeyCheck, type KeyName } from '../../lib/keys';

export async function saveSettingsAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction((panel, t) => saveSettings(panel, form, t));
}

export async function checkKeysAction(): Promise<Record<KeyName, KeyCheck>> {
  try {
    return await checkKeys((await getPanel()).env);
  } catch (error) {
    // only a panel start failure gets here (no key is involved)
    console.error(error);
    // the page shows "could not check" instead of the error boundary
    const failed: KeyCheck = { state: 'error' };
    return { anthropic: failed, elevenlabs: failed };
  }
}
