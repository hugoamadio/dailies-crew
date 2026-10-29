import 'server-only';
import { updateSettings } from '@dailies-crew/studio';
import type { Dictionary } from '../../i18n/dictionary';
import { settingsFromForm } from '../forms/settings';
import type { Panel } from '../panel';
import { done } from './result';
import type { ActionState } from './state';
import { syncQuietly } from './studio';

/** As "crew settings:set": save, then the schedules follow a new time zone */
export async function saveSettings(
  panel: Panel,
  form: FormData,
  t: Dictionary,
): Promise<ActionState> {
  await updateSettings(panel.ctx.db, settingsFromForm(form, t.settings.modelExists));
  return done((await syncQuietly(panel)) ? t.settings.saved : t.settings.savedNoSync);
}
