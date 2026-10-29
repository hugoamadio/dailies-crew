import { cents, checked, text, textOrNull } from './read';

/** The product form as the changes updateProduct takes (photos come apart, as files) */
export function productPatchFromForm(form: FormData): Record<string, unknown> {
  return {
    name: text(form, 'name'),
    description: text(form, 'description'),
    // the fields carry the schema's names; people type money, not cents
    priceCents: cents(form, 'priceCents'),
    oldPriceCents: cents(form, 'oldPriceCents') ?? null,
    currency: text(form, 'currency'),
    category: textOrNull(form, 'category'),
    link: textOrNull(form, 'link'),
  };
}

/** The product form as createProduct's input */
export function productFromForm(form: FormData): Record<string, unknown> {
  return { ...productPatchFromForm(form), active: checked(form, 'active') };
}
