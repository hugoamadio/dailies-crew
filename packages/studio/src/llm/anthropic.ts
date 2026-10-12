import Anthropic, {
  AnthropicError,
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type {
  BetaMessage,
  BetaMessageStreamParams,
} from '@anthropic-ai/sdk/resources/beta/messages';
import type {
  ImageBlockParam,
  Message,
  TextBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import type { MessageStreamParams } from '@anthropic-ai/sdk/resources/messages/messages';
import type { z } from 'zod';
import type { RoleName } from '../roles';
import type { TokenUsage } from '../costs/math';
import { LlmError, LlmInvalidOutputError, LlmRefusalError, LlmTruncatedError } from './errors';
import { parseJsonAnswer } from './parse';
import type { LlmClient, LlmContent, LlmRequest, LlmResult } from './types';

/**
 * Explicit timeout and retries. The SDK arms the timeout only until the response headers arrive;
 * calls stream (see below) so the headers come at once and a long answer is never cut by it.
 */
export const ANTHROPIC_TIMEOUT_MS = 10 * 60 * 1000;
export const ANTHROPIC_MAX_RETRIES = 2;
/** Server-side fallback in its "default" form: Anthropic picks the model by refusal category */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** The two SDK methods AnthropicLlm calls (streamed, read as one final message); the tests pass mocks */
export interface AnthropicMessagesApi {
  messages: { stream(body: MessageStreamParams): { finalMessage(): Promise<Message> } };
  beta: {
    messages: { stream(body: BetaMessageStreamParams): { finalMessage(): Promise<BetaMessage> } };
  };
}

/** Haiku has no server-side fallback: a fallback list is a 400 and "default" does nothing */
export function usesFallback(model: string): boolean {
  return !model.startsWith('claude-haiku');
}

function toBlock(content: LlmContent): TextBlockParam | ImageBlockParam {
  const cache = content.cacheBreakpoint ? { cache_control: { type: 'ephemeral' as const } } : {};
  if (content.type === 'text') return { type: 'text', text: content.text, ...cache };
  return {
    type: 'image',
    source: { type: 'base64', media_type: content.mediaType, data: content.data },
    ...cache,
  };
}

/**
 * Only the JSON schema is sent. zodOutputFormat also carries a `parse` hook, and with it the SDK's
 * stream helper parses every text block itself and rejects with a generic error, hiding the stop
 * reason and the zod issues; without it the helper leaves the text alone and generate() checks it.
 */
function outputFormat<T>(schema: z.ZodType<T>) {
  const { type, schema: jsonSchema } = zodOutputFormat(schema);
  return { type, schema: jsonSchema };
}

/** SDK errors become LlmErrors (by class and status, never by message text) */
export function classifyError(role: RoleName, error: unknown): unknown {
  if (!(error instanceof AnthropicError)) return error;
  const what = `Claude API (${role})`;
  if (error instanceof APIConnectionError) {
    return new LlmError('network', `${what}: could not connect (${error.message})`, true);
  }
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
    return new LlmError('auth', `${what}: the API key was refused (${error.status})`, false);
  }
  // The API has answered an empty balance as a 400 "Your credit balance is too low...", so this
  // one message check exists; everything else is classified by class and status.
  const emptyBalance =
    error instanceof BadRequestError &&
    error.type === 'invalid_request_error' &&
    /credit balance/i.test(error.message);
  if (
    emptyBalance ||
    (error instanceof APIError && (error.status === 402 || error.type === 'billing_error'))
  ) {
    return new LlmError('credit', `${what}: billing problem, check the credit balance`, false);
  }
  if (error instanceof RateLimitError) {
    return new LlmError('rate_limit', `${what}: rate limited`, true);
  }
  if (error instanceof APIError && typeof error.status === 'number' && error.status >= 500) {
    return new LlmError('overloaded', `${what}: the API is unavailable (${error.status})`, true);
  }
  return new LlmError('bad_request', `${what}: ${error.message}`, false);
}

/**
 * One structured call per role: adaptive thinking, the role's effort, the answer constrained to
 * the role's JSON schema. Opus and Sonnet go through the beta endpoint with the server-side
 * refusal fallback; Haiku through the plain one.
 */
export class AnthropicLlm implements LlmClient {
  readonly name = 'anthropic';
  private readonly api: AnthropicMessagesApi;

  constructor(options: { apiKey: string } | { api: AnthropicMessagesApi }) {
    this.api =
      'api' in options
        ? options.api
        : new Anthropic({
            apiKey: options.apiKey,
            // a stray ANTHROPIC_AUTH_TOKEN would add a second auth header and look like a refused key
            authToken: null,
            maxRetries: ANTHROPIC_MAX_RETRIES,
            timeout: ANTHROPIC_TIMEOUT_MS,
          });
  }

  async generate<T>(request: LlmRequest<T>): Promise<LlmResult<T>> {
    const body = {
      model: request.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: [{ role: 'user' as const, content: request.content.map(toBlock) }],
      thinking: { type: 'adaptive' as const },
      output_config: { effort: request.effort, format: outputFormat(request.schema) },
    };
    let message: Message | BetaMessage;
    try {
      message = usesFallback(request.model)
        ? await this.api.beta.messages
            .stream({ ...body, betas: [FALLBACK_BETA], fallbacks: 'default' })
            .finalMessage()
        : await this.api.messages.stream(body).finalMessage();
    } catch (error) {
      throw classifyError(request.role, error);
    }
    const usage: TokenUsage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    };
    try {
      if (message.stop_reason === 'refusal') {
        throw new LlmRefusalError(request.role, message.stop_details?.category ?? null);
      }
      if (
        message.stop_reason === 'max_tokens' ||
        message.stop_reason === 'model_context_window_exceeded'
      ) {
        throw new LlmTruncatedError(request.role, request.maxTokens);
      }
      // A mid-stream fallback leaves the refused model's partial text and continues in a second block
      const texts = message.content.flatMap((block) => (block.type === 'text' ? [block.text] : []));
      if (texts.length === 0)
        throw new LlmInvalidOutputError(request.role, ['- (answer): no text']);
      return {
        data: parseJsonAnswer(request.role, request.schema, texts.join('')),
        model: message.model,
        usage,
      };
    } catch (error) {
      // the answer arrived and was billed: the error carries what it cost
      if (error instanceof LlmError) {
        error.model = message.model;
        error.usage = usage;
      }
      throw error;
    }
  }
}
