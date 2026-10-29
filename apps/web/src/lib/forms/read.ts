// FormData → plain values. Fields are named after the paths of the studio's schemas
// ("brand.colors.primary"), so a StudioError's issues land next to the right field.

/** The trimmed text of a field ('' when missing) */
export function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/** The text, or null when empty (optional fields the schemas take as null) */
export function textOrNull(form: FormData, name: string): string | null {
  return text(form, name) || null;
}

/** A number: undefined when empty (the schema says "required"), NaN when not a number */
export function num(form: FormData, name: string): number | undefined {
  const value = text(form, name).replace(',', '.');
  if (value === '') return undefined;
  return /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : Number.NaN;
}

/** Every non-empty value of a repeated field (checkboxes, hidden lists) */
export function all(form: FormData, name: string): string[] {
  return form
    .getAll(name)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

/** One entry per non-empty line of a textarea */
export function lines(form: FormData, name: string): string[] {
  return text(form, name)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function checked(form: FormData, name: string): boolean {
  return form.get(name) === 'on';
}

/**
 * Money typed by a person ("89.90", "89,90", "89") in cents; undefined when empty, NaN when it
 * is not an amount with at most two decimals
 */
export function cents(form: FormData, name: string): number | undefined {
  const value = text(form, name).replace(',', '.');
  if (value === '') return undefined;
  return /^\d+(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : Number.NaN;
}
