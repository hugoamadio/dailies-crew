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
  return checkKeys((await getPanel()).env);
}
