'use client';

import { useActionState } from 'react';
import type { Dictionary } from '../i18n/dictionary';
import type { KeyCheck, KeyName } from '../lib/keys';
import { buttonClass, cx } from './ui';

type Results = Record<KeyName, KeyCheck> | null;

/** "Check keys": asks the server to call each provider's free endpoint and shows the answers */
export function KeyCheckButton(props: { action: () => Promise<Results>; t: Dictionary }) {
  const s = props.t.settings;
  const [results, check, pending] = useActionState(async () => props.action(), null as Results);
  return (
    <form action={check} className="space-y-3">
      <button type="submit" disabled={pending} className={buttonClass('secondary', 'sm')}>
        {pending ? s.checking : s.checkKeys}
      </button>
      {results ? (
        <ul className="space-y-1 text-sm" role="status">
          {(Object.entries(results) as [KeyName, KeyCheck][]).map(([name, result]) => (
            <li key={name}>
              {s[name]}:{' '}
              <strong
                className={cx(
                  result.state === 'ok'
                    ? 'text-good'
                    : result.state === 'missing'
                      ? 'text-muted'
                      : 'text-bad',
                )}
              >
                {s.keyResults[result.state]}
              </strong>
              {result.detail ? <span className="text-muted"> ({result.detail})</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
