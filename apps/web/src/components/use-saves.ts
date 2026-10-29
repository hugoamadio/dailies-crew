'use client';

import { useState } from 'react';
import type { ActionState } from '../lib/actions/state';

/**
 * How many saves have succeeded. Forms submitted with onSubmit are not reset by React, so a field
 * that must start empty after a save (a new model, a file input) takes this as its `key`.
 */
export function useSaves(state: ActionState): number {
  const [seen, setSeen] = useState(state);
  const [saves, setSaves] = useState(0);
  if (state !== seen) {
    setSeen(state);
    if (state.status === 'ok') setSaves(saves + 1);
  }
  return saves;
}
