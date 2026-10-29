import { StudioError } from '@dailies-crew/studio';
import type { ActionState } from './state';

export function done(message: string): ActionState {
  return { status: 'ok', message };
}

/**
 * A StudioError's message is meant for the person (and its issues name the form fields, which are
 * named after the same paths); anything else is a bug: logged on the server, never shown raw.
 */
export function failure(error: unknown, unexpected: string): ActionState {
  if (error instanceof StudioError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) fields[issue.path] ??= issue.message;
    const message = error.issues.length > 0 ? error.message.split('\n')[0]! : error.message;
    return { status: 'error', message, fields };
  }
  console.error(error);
  return { status: 'error', message: unexpected, fields: {} };
}
