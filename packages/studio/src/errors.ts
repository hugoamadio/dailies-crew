import { formatIssues, zodIssues } from '@dailies-crew/plan';
import type { z } from 'zod';

/** A problem the person can fix (invalid input, unknown id, wrong state); its message is shown as is */
export class StudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudioError';
  }
}

/** Parses with the schema or throws a StudioError listing every problem, one per line */
export function parseInput<S extends z.ZodType>(
  schema: S,
  value: unknown,
  what: string,
): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new StudioError(`Invalid ${what}:\n${formatIssues(zodIssues(parsed.error))}`);
  }
  return parsed.data;
}
