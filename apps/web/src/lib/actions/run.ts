import 'server-only';
import { revalidatePath } from 'next/cache';
import type { Dictionary } from '../../i18n/dictionary';
import { getI18n } from '../../i18n/server';
import { getPanel, type Panel } from '../panel';
import { failure } from './result';
import type { ActionState } from './state';

/**
 * The body of every server action: the panel and the texts in, the answer out; studio errors
 * become messages, and every page shows fresh data afterwards (one user: refreshing all is cheap).
 */
export async function runAction(
  work: (panel: Panel, t: Dictionary) => Promise<ActionState>,
): Promise<ActionState> {
  const { t } = await getI18n();
  try {
    const state = await work(await getPanel(), t);
    revalidatePath('/', 'layout');
    return state;
  } catch (error) {
    return failure(error, t.common.unexpected);
  }
}
