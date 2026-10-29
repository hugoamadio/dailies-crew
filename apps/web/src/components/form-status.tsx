'use client';

import type { ActionState } from '../lib/actions/state';

/** The form's answer: a green note when saved, the error in red otherwise */
export function FormStatus({ state }: { state: ActionState }) {
  if (state.status === 'idle') return null;
  return (
    <p
      role={state.status === 'error' ? 'alert' : 'status'}
      className={
        state.status === 'error'
          ? 'rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad'
          : 'rounded-lg bg-good-soft px-3 py-2 text-sm text-good'
      }
    >
      {state.message}
    </p>
  );
}
