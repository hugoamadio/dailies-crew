import { en } from './en';
import type { Locale } from './locale';
import { ptBR } from './pt-BR';

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

/** The shape of en.ts with every text widened to string: pt-BR.ts must match it exactly */
export type Dictionary = Widen<typeof en>;

const DICTIONARIES: Record<Locale, Dictionary> = { en, 'pt-BR': ptBR };

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
