import type { RoleName } from '../roles';

export type LlmErrorKind =
  | 'auth'
  | 'credit'
  | 'rate_limit'
  | 'overloaded'
  | 'network'
  | 'refusal'
  | 'invalid_output'
  | 'truncated'
  | 'bad_request';

/**
 * A failed Claude call, classified. `retryable` tells the queue whether trying again can help;
 * "auth" and "credit" stop every line instead (spec section 9). Messages never carry the key.
 */
export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export class LlmRefusalError extends LlmError {
  constructor(role: RoleName, category: string | null) {
    super(
      'refusal',
      `Claude declined the ${role} request (category: ${category ?? 'none'})`,
      false,
    );
    this.name = 'LlmRefusalError';
  }
}

export class LlmTruncatedError extends LlmError {
  constructor(role: RoleName, maxTokens: number) {
    super('truncated', `The ${role} answer was cut at ${maxTokens} tokens`, true);
    this.name = 'LlmTruncatedError';
  }
}

export class LlmInvalidOutputError extends LlmError {
  constructor(
    role: RoleName,
    readonly issues: string[],
  ) {
    super(
      'invalid_output',
      `The ${role} answer does not fit its schema:\n${issues.join('\n')}`,
      true,
    );
    this.name = 'LlmInvalidOutputError';
  }
}
