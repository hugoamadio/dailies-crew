import 'server-only';
import { cookies, headers } from 'next/headers';
import { type Dictionary, dictionaryFor } from './dictionary';
import { LOCALE_COOKIE, type Locale, pickLocale } from './locale';

/** The request's language (cookie, then Accept-Language) and its texts, in server code */
export async function getI18n(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = pickLocale(
    (await cookies()).get(LOCALE_COOKIE)?.value,
    (await headers()).get('accept-language'),
  );
  return { locale, t: dictionaryFor(locale) };
}
