import { formatIssues, zodIssues } from '@dailies-crew/plan';
import type { z } from 'zod';
import type { RoleName } from '../roles';
import { LlmInvalidOutputError } from './errors';

/**
 * Checks an answer with the full zod schema. The JSON schema sent to the API cannot carry every
 * rule (lengths, ranges, patterns), so this is where they are enforced.
 */
export function parseAnswer<T>(role: RoleName, schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new LlmInvalidOutputError(role, formatIssues(zodIssues(parsed.error)).split('\n'));
  }
  return parsed.data;
}

export function parseJsonAnswer<T>(role: RoleName, schema: z.ZodType<T>, text: string): T {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new LlmInvalidOutputError(role, ['- (answer): not valid JSON']);
  }
  return parseAnswer(role, schema, value);
}
