// No imports here: client components import this file

/** What a form action answers; the form shows the message and each field's error */
export type ActionState =
  | { status: 'idle' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string; fields: Record<string, string> };

export const IDLE: ActionState = { status: 'idle' };

export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** The error of one field, when the last answer had one */
export function fieldError(state: ActionState, name: string): string | undefined {
  return state.status === 'error' ? state.fields[name] : undefined;
}
