'use client';

import { useActionState } from 'react';
import { type FormAction, IDLE } from '../lib/actions/state';
import { buttonClass, type ButtonVariant } from './ui';

/**
 * One button that runs a server action (bound to its target on the server) and shows the answer
 * next to it. With `confirm`, the browser asks first.
 */
export function ActionButton(props: {
  action: FormAction;
  label: string;
  pendingLabel: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  confirm?: string;
  disabled?: boolean;
  showDone?: boolean;
}) {
  const [state, run, pending] = useActionState(props.action, IDLE);
  return (
    <form
      action={run}
      className="inline-flex flex-col items-start gap-1"
      onSubmit={(event) => {
        if (props.confirm && !window.confirm(props.confirm)) event.preventDefault();
      }}
    >
      <button
        type="submit"
        disabled={pending || props.disabled}
        className={buttonClass(props.variant, props.size ?? 'sm')}
      >
        {pending ? props.pendingLabel : props.label}
      </button>
      {state.status === 'error' ? (
        <span role="alert" className="text-xs text-bad">
          {state.message}
        </span>
      ) : null}
      {state.status === 'ok' && props.showDone ? (
        <span role="status" className="text-xs text-good">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
