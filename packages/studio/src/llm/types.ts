import type { z } from 'zod';
import type { TokenUsage } from '../costs/math';
import type { Effort, RoleName } from '../roles';

export type LlmContent = (
  | { type: 'text'; text: string }
  /** A base64 picture: the review frames */
  | { type: 'image'; mediaType: 'image/png' | 'image/jpeg'; data: string }
) & {
  /** Caches the prompt up to this block, so the next calls sharing it pay a tenth (reviewers) */
  cacheBreakpoint?: boolean;
};

export interface LlmRequest<T> {
  role: RoleName;
  model: string;
  effort: Effort;
  system: string;
  content: LlmContent[];
  /** The answer's shape: sent as a JSON schema, then checked again with every zod rule */
  schema: z.ZodType<T>;
  /** Output budget, thinking included */
  maxTokens: number;
  /** The inputs the prompt was built from, as data. Only the fake AI reads them; never sent. */
  facts?: unknown;
}

export interface LlmResult<T> {
  data: T;
  /** The model that answered (a server-side fallback can differ from the requested one) */
  model: string;
  usage: TokenUsage;
}

export interface LlmClient {
  readonly name: 'anthropic' | 'fake';
  generate<T>(request: LlmRequest<T>): Promise<LlmResult<T>>;
}
