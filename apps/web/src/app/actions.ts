'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isLocale, LOCALE_COOKIE } from '../i18n/locale';
import { runAction } from '../lib/actions/run';
import type { ActionState } from '../lib/actions/state';
import { resumeAll, retry } from '../lib/actions/studio';

export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = formData.get('locale');
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
  revalidatePath('/', 'layout');
}

export async function resumeAction(): Promise<ActionState> {
  return runAction((panel, t) => resumeAll(panel, t));
}

export async function retryAction(videoId: string): Promise<ActionState> {
  return runAction((panel, t) => retry(panel, videoId, t));
}
