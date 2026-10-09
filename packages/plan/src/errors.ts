import type { z } from 'zod';

export interface PlanIssue {
  /** Dotted path inside the plan, e.g. "scenes.2.params.price"; empty for the whole plan */
  path: string;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; issues: PlanIssue[] };

export function zodIssues(error: z.ZodError, prefix = ''): PlanIssue[] {
  return error.issues.map((issue) => ({
    path: [prefix, ...issue.path.map(String)].filter((part) => part !== '').join('.'),
    message: issue.message,
  }));
}

export function formatIssues(issues: readonly PlanIssue[]): string {
  return issues.map((issue) => `- ${issue.path || '(plan)'}: ${issue.message}`).join('\n');
}

export class PlanError extends Error {
  constructor(readonly issues: PlanIssue[]) {
    super(`The direction plan is invalid:\n${formatIssues(issues)}`);
    this.name = 'PlanError';
  }
}
