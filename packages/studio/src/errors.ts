import { formatIssues, type PlanIssue, zodIssues } from '@dailies-crew/plan';
import type { z } from 'zod';

/** A problem the person can fix (invalid input, unknown id, wrong state); its message is shown as is */
export class StudioError extends Error {
  /** For invalid input: each problem with the path of its field (e.g. "brand.colors.primary") */
  readonly issues: readonly PlanIssue[];

  constructor(message: string, issues: readonly PlanIssue[] = []) {
    super(message);
    this.name = 'StudioError';
    this.issues = issues;
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
    const issues = zodIssues(parsed.error);
    throw new StudioError(`Invalid ${what}:\n${formatIssues(issues)}`, issues);
  }
  return parsed.data;
}
