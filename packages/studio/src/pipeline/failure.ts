import { PlanError } from '@dailies-crew/plan';
import { EngineError } from '@dailies-crew/engine/errors';
import { VoiceProviderError } from '@dailies-crew/engine/voice';
import { StudioError } from '../errors';
import { LlmError } from '../llm/errors';

export interface Failure {
  /** An LlmError kind, "voice", "voice_auth", "plan", "engine", "input" or "unknown" */
  kind: string;
  message: string;
  /** Trying the same stage again can help */
  retryable: boolean;
  /** A refused key or no credit: every line stops and waits for "crew resume" */
  stopsEverything: boolean;
}

/** Failure kinds "crew resume" re-enqueues once the key or the credit is fixed */
export const RESUMABLE_FAILURES = ['auth', 'credit', 'voice_auth', 'paused'];

export function classifyFailure(error: unknown): Failure {
  if (error instanceof LlmError) {
    const stops = error.kind === 'auth' || error.kind === 'credit';
    return {
      kind: error.kind,
      message: error.message,
      retryable: error.retryable,
      stopsEverything: stops,
    };
  }
  if (error instanceof VoiceProviderError) {
    const refused = error.status === 401 || error.status === 402 || error.status === 403;
    return {
      kind: refused ? 'voice_auth' : 'voice',
      message: error.message,
      retryable: error.retryable,
      stopsEverything: refused,
    };
  }
  if (error instanceof PlanError) {
    return { kind: 'plan', message: error.message, retryable: false, stopsEverything: false };
  }
  if (error instanceof EngineError) {
    return { kind: 'engine', message: error.message, retryable: false, stopsEverything: false };
  }
  if (error instanceof StudioError) {
    return { kind: 'input', message: error.message, retryable: false, stopsEverything: false };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { kind: 'unknown', message, retryable: true, stopsEverything: false };
}
