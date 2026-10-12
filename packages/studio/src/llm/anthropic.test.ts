import {
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AnthropicLlm, FALLBACK_BETA } from './anthropic';
import { LlmError, LlmInvalidOutputError, LlmRefusalError, LlmTruncatedError } from './errors';
import type { LlmRequest } from './types';

const Answer = z.strictObject({
  title: z.string().max(10),
  score: z.number().int().min(0).max(10),
});

const api = { messages: { create: vi.fn() }, beta: { messages: { create: vi.fn() } } };
const llm = new AnthropicLlm({ api });

function request(model: string, overrides: Partial<LlmRequest<unknown>> = {}) {
  return {
    role: 'judge' as const,
    model,
    effort: 'low' as const,
    system: 'You score ideas.',
    content: [{ type: 'text' as const, text: 'Score this.' }],
    schema: Answer,
    maxTokens: 8000,
    ...overrides,
  };
}

function message(text: string, overrides: Record<string, unknown> = {}) {
  return {
    model: 'claude-sonnet-5-5',
    stop_reason: 'end_turn',
    stop_details: null,
    content: [
      { type: 'thinking', thinking: '', signature: 'x' },
      { type: 'text', text, citations: null },
    ],
    usage: {
      input_tokens: 1200,
      output_tokens: 300,
      cache_read_input_tokens: 100,
      cache_creation_input_tokens: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AnthropicLlm', () => {
  it('asks Sonnet and Opus through the beta endpoint with the server-side fallback', async () => {
    api.beta.messages.create.mockResolvedValue(message('{"title":"Lua","score":8}'));
    const result = await llm.generate(
      request('claude-sonnet-5-5', {
        content: [
          { type: 'image', mediaType: 'image/jpeg', data: 'AAAA', cacheBreakpoint: true },
          { type: 'text', text: 'Score this.' },
        ],
      }),
    );

    expect(result).toEqual({
      data: { title: 'Lua', score: 8 },
      model: 'claude-sonnet-5-5',
      usage: { inputTokens: 1200, outputTokens: 300, cacheReadTokens: 100, cacheWriteTokens: 0 },
    });
    const body = api.beta.messages.create.mock.calls[0]![0];
    expect(body).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 8000,
      system: 'You score ideas.',
      thinking: { type: 'adaptive' },
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' },
              cache_control: { type: 'ephemeral' },
            },
            { type: 'text', text: 'Score this.' },
          ],
        },
      ],
    });
    expect(body.output_config.effort).toBe('low');
    expect(body.output_config.format).toMatchObject({
      type: 'json_schema',
      schema: { type: 'object', additionalProperties: false, required: ['title', 'score'] },
    });
    expect(api.messages.create).not.toHaveBeenCalled();
  });

  it('asks Haiku through the plain endpoint, without fallback', async () => {
    api.messages.create.mockResolvedValue(message('{"title":"Lua","score":3}'));
    await llm.generate(request('claude-haiku-5-5'));
    const body = api.messages.create.mock.calls[0]![0];
    expect(body).not.toHaveProperty('betas');
    expect(body).not.toHaveProperty('fallbacks');
    expect(api.beta.messages.create).not.toHaveBeenCalled();
  });

  it('turns a refusal, a cut answer and a broken rule into typed errors', async () => {
    api.beta.messages.create.mockResolvedValueOnce(
      message('', {
        stop_reason: 'refusal',
        content: [],
        stop_details: { type: 'refusal', category: 'cyber', explanation: null },
      }),
    );
    await expect(llm.generate(request('claude-opus-5-5'))).rejects.toThrow(LlmRefusalError);

    api.beta.messages.create.mockResolvedValueOnce(
      message('{"title":"Lu', { stop_reason: 'max_tokens' }),
    );
    await expect(llm.generate(request('claude-opus-5-5'))).rejects.toThrow(LlmTruncatedError);

    // maxLength is not sent to the API, so the zod schema is what catches it
    api.beta.messages.create.mockResolvedValueOnce(
      message('{"title":"A very long title","score":8}'),
    );
    const error = await llm.generate(request('claude-opus-5-5')).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LlmInvalidOutputError);
    expect((error as LlmInvalidOutputError).issues[0]).toMatch(/^- title: /);
    expect((error as LlmError).retryable).toBe(true);
  });

  const headers = new Headers();
  it.each([
    [
      new AuthenticationError(401, {}, 'invalid x-api-key', headers, 'authentication_error'),
      'auth',
      false,
    ],
    [new APIError(402, {}, 'billing', headers, 'billing_error'), 'credit', false],
    [new RateLimitError(429, {}, 'rate limited', headers, 'rate_limit_error'), 'rate_limit', true],
    [
      new InternalServerError(529, {}, 'overloaded', headers, 'overloaded_error'),
      'overloaded',
      true,
    ],
    [new APIConnectionError({ message: 'Connection error.' }), 'network', true],
    [
      new BadRequestError(400, {}, 'max_tokens too large', headers, 'invalid_request_error'),
      'bad_request',
      false,
    ],
  ])('classifies %s', async (sdkError, kind, retryable) => {
    api.beta.messages.create.mockRejectedValue(sdkError);
    const error = await llm.generate(request('claude-opus-5-5')).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LlmError);
    expect(error).toMatchObject({ kind, retryable });
  });

  it('lets errors that do not come from the SDK through untouched', async () => {
    const bug = new TypeError('x is undefined');
    api.beta.messages.create.mockRejectedValue(bug);
    await expect(llm.generate(request('claude-opus-5-5'))).rejects.toBe(bug);
  });
});
