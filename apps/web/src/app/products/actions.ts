'use server';

import { redirect } from 'next/navigation';
import {
  createProductFromForm,
  switchProduct,
  updateProductFromForm,
} from '../../lib/actions/products';
import { runAction } from '../../lib/actions/run';
import type { ActionState } from '../../lib/actions/state';

export async function createProductAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const created: { id?: string } = {};
  const state = await runAction(async (panel, t) => {
    const result = await createProductFromForm(panel, form, t);
    created.id = result.id;
    return result.state;
  });
  if (created.id) redirect('/products');
  return state;
}

export async function updateProductAction(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction((panel, t) => updateProductFromForm(panel, id, form, t));
}

export async function switchProductAction(id: string, active: boolean): Promise<ActionState> {
  return runAction((panel, t) => switchProduct(panel, id, active, t));
}
