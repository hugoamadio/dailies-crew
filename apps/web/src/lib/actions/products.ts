import 'server-only';
import { createProduct, setProductActive, updateProduct } from '@dailies-crew/studio';
import type { Dictionary } from '../../i18n/dictionary';
import { productFromForm, productPatchFromForm } from '../forms/product';
import type { Panel } from '../panel';
import { filesFrom, withUploads } from '../uploads';
import { done } from './result';
import type { ActionState } from './state';

/** "New product": the fields and the uploaded photos, as "crew product:add" */
export async function createProductFromForm(
  panel: Panel,
  form: FormData,
  t: Dictionary,
): Promise<{ state: ActionState; id: string }> {
  const product = await withUploads(panel.ctx.dataDir, filesFrom(form, 'photos'), (photos) =>
    createProduct(panel.ctx, productFromForm(form), photos),
  );
  return { state: done(t.products.saved), id: product.id };
}

/** The edit form: new photos (if any) replace the current ones */
export async function updateProductFromForm(
  panel: Panel,
  id: string,
  form: FormData,
  t: Dictionary,
): Promise<ActionState> {
  await withUploads(panel.ctx.dataDir, filesFrom(form, 'photos'), (photos) =>
    updateProduct(panel.ctx, id, productPatchFromForm(form), photos),
  );
  return done(t.products.saved);
}

export async function switchProduct(
  panel: Panel,
  id: string,
  active: boolean,
  t: Dictionary,
): Promise<ActionState> {
  await setProductActive(panel.ctx.db, id, active);
  return done(active ? t.products.activated : t.products.deactivated);
}
