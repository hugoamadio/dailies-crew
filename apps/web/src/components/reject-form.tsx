'use client';

import { startTransition, useActionState, useState } from 'react';
import type { Dictionary } from '../i18n/dictionary';
import { fieldError, type FormAction, IDLE } from '../lib/actions/state';
import { FormStatus } from './form-status';
import { buttonClass, Field, inputClass } from './ui';

// A client copy (the studio index is server-only): the stages rejectVideo accepts as a redo target
const TARGETS = ['script', 'direction', 'produce'] as const;

/** Reject with a reason: redo (back to a stage, the AI picks one unless Hugo does) or learn only */
export function RejectForm(props: { action: FormAction; t: Dictionary }) {
  const { t } = props;
  const v = t.videos;
  const [state, submit, pending] = useActionState(props.action, IDLE);
  const [mode, setMode] = useState<'redo' | 'learn'>('redo');
  return (
    <form
      className="space-y-3"
      // not action={submit}: React 19 empties the fields of a form action once it answers, and
      // a refused reject must keep the typed reason
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => submit(data));
      }}
    >
      <Field label={v.reason} name="reason" hint={v.reasonHint} error={fieldError(state, 'reason')}>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          required
          minLength={3}
          maxLength={1000}
          className={inputClass}
        />
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{v.mode}</legend>
        <div className="space-y-1 text-sm">
          {(['redo', 'learn'] as const).map((each) => (
            <label key={each} className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                value={each}
                checked={mode === each}
                onChange={() => setMode(each)}
              />
              {each === 'redo' ? v.modeRedo : v.modeLearn}
            </label>
          ))}
        </div>
      </fieldset>
      {mode === 'redo' ? (
        <Field label={v.targetStage} name="targetStage">
          <select id="targetStage" name="targetStage" defaultValue="" className={inputClass}>
            <option value="">{v.targetAuto}</option>
            {TARGETS.map((stage) => (
              <option key={stage} value={stage}>
                {t.stages[stage]}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <button type="submit" disabled={pending} className={buttonClass('danger')}>
        {pending ? v.rejecting : v.reject}
      </button>
      <FormStatus state={state} />
    </form>
  );
}
