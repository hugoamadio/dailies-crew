import { ZERO_USAGE } from '../costs/math';
import type { RoleName } from '../roles';
import { parseAnswer } from './parse';
import type { LlmClient, LlmRequest, LlmResult } from './types';

/** Builds a role's answer from the facts its prompt was made of */
export type FakeResponder = (facts: unknown, request: LlmRequest<unknown>) => unknown;

/**
 * The fake AI ("IA de mentira"): deterministic answers built from each request's own facts, so
 * the whole pipeline runs offline, in CI and for free. Answers are checked against the role's
 * schema like real ones, and the usage is zero.
 */
export class FakeLlm implements LlmClient {
  readonly name = 'fake';
  /** Every request received, in order (tests read it) */
  readonly calls: LlmRequest<unknown>[] = [];
  private readonly scripted = new Map<RoleName, unknown[]>();

  constructor(private readonly responders: Partial<Record<RoleName, FakeResponder>> = {}) {}

  /** Answers (or errors to throw) used, in order, before the role's responder */
  script(role: RoleName, ...answers: unknown[]): this {
    this.scripted.set(role, [...(this.scripted.get(role) ?? []), ...answers]);
    return this;
  }

  async generate<T>(request: LlmRequest<T>): Promise<LlmResult<T>> {
    this.calls.push(request as LlmRequest<unknown>);
    const queue = this.scripted.get(request.role);
    const answer = queue?.length
      ? queue.shift()
      : this.responders[request.role]?.(request.facts, request as LlmRequest<unknown>);
    if (answer instanceof Error) throw answer;
    if (answer === undefined) throw new Error(`The fake AI has no answer for role ${request.role}`);
    return {
      data: parseAnswer(request.role, request.schema, answer),
      model: request.model,
      usage: ZERO_USAGE,
    };
  }
}
