'use server';

import { redirect } from 'next/navigation';
import {
  createLineFromForm,
  editRule,
  removeRule,
  runLineNow,
  switchLine,
  switchRule,
  updateLineFromForm,
} from '../../lib/actions/lines';
import { runAction } from '../../lib/actions/run';
import type { ActionState } from '../../lib/actions/state';

export async function createLineAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const created: { id?: string } = {};
  const state = await runAction(async (panel, t) => {
    const result = await createLineFromForm(panel, form, t);
    created.id = result.id;
    return result.state;
  });
  // outside runAction: redirect() works by throwing, which runAction would report as an error
  if (created.id) redirect(`/lines/${created.id}`);
  return state;
}

export async function updateLineAction(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction((panel, t) => updateLineFromForm(panel, id, form, t));
}

export async function switchLineAction(id: string, on: boolean): Promise<ActionState> {
  return runAction((panel, t) => switchLine(panel, id, on, t));
}

export async function runNowAction(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction((panel, t) => runLineNow(panel, id, form, t));
}

export async function editRuleAction(
  ruleId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction((panel, t) => editRule(panel, ruleId, form, t));
}

export async function switchRuleAction(ruleId: string, active: boolean): Promise<ActionState> {
  return runAction((panel, t) => switchRule(panel, ruleId, active, t));
}

export async function deleteRuleAction(ruleId: string): Promise<ActionState> {
  return runAction((panel, t) => removeRule(panel, ruleId, t));
}
