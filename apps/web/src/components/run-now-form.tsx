'use client';

import { Play } from 'lucide-react';
import { startTransition, useActionState } from 'react';
import { type FormAction, IDLE } from '../lib/actions/state';
import { buttonClass } from './ui';

/** "Run now" with how many videos (1 to 10), as "crew run-now --count" */
export function RunNowForm(props: {
  action: FormAction;
  label: string;
  countLabel: string;
  pendingLabel: string;
  defaultCount: number;
}) {
  const [state, run, pending] = useActionState(props.action, IDLE);
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        // not action={run}: React 19 would reset the count after an error answer
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => run(data));
      }}
    >
      <div className="flex items-center gap-2">
        <input
          type="number"
          name="count"
          min={1}
          max={10}
          defaultValue={props.defaultCount}
          aria-label={props.countLabel}
          className="h-8 w-16 rounded-lg border border-line bg-panel px-2 text-sm text-ink focus:border-accent focus:outline-none"
        />
        <button type="submit" disabled={pending} className={buttonClass('secondary', 'sm')}>
          <Play size={14} aria-hidden />
          {pending ? props.pendingLabel : props.label}
        </button>
      </div>
      {state.status !== 'idle' ? (
        <span
          role={state.status === 'error' ? 'alert' : 'status'}
          className={state.status === 'error' ? 'text-xs text-bad' : 'text-xs text-good'}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
