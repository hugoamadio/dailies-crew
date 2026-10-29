'use client';

import { startTransition, useActionState, useState } from 'react';
import type { Dictionary } from '../i18n/dictionary';
import { type FormAction, IDLE } from '../lib/actions/state';
import { ActionButton } from './action-button';
import { Badge, buttonClass, inputClass } from './ui';

/** One learned rule: on/off, edit its text in place, delete it */
export function RuleItem(props: {
  rule: { id: string; text: string; active: boolean };
  t: Dictionary;
  saveAction: FormAction;
  switchAction: FormAction;
  deleteAction: FormAction;
}) {
  const { t, rule } = props;
  const [editing, setEditing] = useState(false);
  const [state, save, pending] = useActionState(async (previous: typeof IDLE, form: FormData) => {
    const next = await props.saveAction(previous, form);
    if (next.status === 'ok') setEditing(false);
    return next;
  }, IDLE);
  return (
    <li className="space-y-2 py-3" data-testid="rule">
      {editing ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            // not action={save}: React 19 would reset the text after an error answer
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startTransition(() => save(data));
          }}
        >
          <textarea
            name="text"
            defaultValue={rule.text}
            rows={2}
            maxLength={200}
            required
            aria-label={t.common.edit}
            className={inputClass}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={buttonClass('primary', 'sm')}>
              {pending ? t.common.saving : t.common.save}
            </button>
            <button
              type="button"
              className={buttonClass('ghost', 'sm')}
              onClick={() => setEditing(false)}
            >
              {t.common.cancel}
            </button>
          </div>
          {state.status === 'error' ? <p className="text-xs text-bad">{state.message}</p> : null}
        </form>
      ) : (
        <p className={rule.active ? 'text-sm' : 'text-sm text-muted line-through'}>{rule.text}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={rule.active ? 'good' : 'neutral'}>
          {rule.active ? t.lines.ruleInUse : t.lines.ruleNotUsed}
        </Badge>
        <ActionButton
          action={props.switchAction}
          label={rule.active ? t.lines.stopRule : t.lines.useRule}
          pendingLabel={t.common.working}
          variant="ghost"
        />
        {editing ? null : (
          <button
            type="button"
            className={buttonClass('ghost', 'sm')}
            onClick={() => setEditing(true)}
          >
            {t.common.edit}
          </button>
        )}
        <ActionButton
          action={props.deleteAction}
          label={t.common.delete}
          pendingLabel={t.common.deleting}
          variant="danger"
          confirm={t.lines.confirmDeleteRule}
        />
      </div>
    </li>
  );
}
