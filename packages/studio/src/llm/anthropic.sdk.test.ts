import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AnthropicLlm, FALLBACK_BETA } from './anthropic';
import { LlmInvalidOutputError, LlmTruncatedError } from './errors';

// These tests go through the real SDK stream helper; only the network is replaced.

const Answer = z.strictObject({
  title: z.string().max(10),
  score: z.number().int().min(0).max(10),
});

interface Captured {
  body: Record<string, any>;
  headers: Headers;
}

function sse(events: [string, unknown][]): string {
  return events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join('');
}

function streamOf(texts: string[], stopReason: string): string {
  const events: [string, unknown][] = [
    [
      'message_start',
      {
        type: 'message_start',
        message: {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-sonnet-5-5',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 1 },
        },
      },
    ],
  ];
  texts.forEach((text, index) => {
    events.push(
      [
        'content_block_start',
        { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
      ],
      [
        'content_block_delta',
        { type: 'content_block_delta', index, delta: { type: 'text_delta', text } },
      ],
      ['content_block_stop', { type: 'content_block_stop', index }],
    );
  });
  events.push(
    [
      'message_delta',
      {
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: 20 },
      },
    ],
    ['message_stop', { type: 'message_stop' }],
  );
  return sse(events);
}

function setup(texts: string[], stopReason = 'end_turn') {
  const captured: Captured[] = [];
  const fakeFetch = async (_url: unknown, init?: RequestInit) => {
    captured.push({
      body: JSON.parse(String(init?.body)),
      headers: new Headers(init?.headers),
    });
    return new Response(streamOf(texts, stopReason), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  };
  const client = new Anthropic({
    apiKey: 'test-key',
    fetch: fakeFetch as typeof fetch,
    maxRetries: 0,
  });
  return { llm: new AnthropicLlm({ api: client }), captured };
}

const request = (model: string) => ({
  role: 'judge' as const,
  model,
  effort: 'low' as const,
  system: 'You score ideas.',
  content: [{ type: 'text' as const, text: 'Score this.' }],
  schema: Answer,
  maxTokens: 8000,
});

describe('AnthropicLlm through the real SDK stream', () => {
  it('parses a valid answer and sends a streamed request with the JSON schema only', async () => {
    const { llm, captured } = setup(['{"title":"Lua","score":8}']);
    const result = await llm.generate(request('claude-sonnet-5-5'));
    expect(result.data).toEqual({ title: 'Lua', score: 8 });
    expect(result.usage.outputTokens).toBe(20);

    const { body, headers } = captured[0]!;
    expect(body.stream).toBe(true);
    expect(body.fallbacks).toBe('default');
    expect(headers.get('anthropic-beta')).toContain(FALLBACK_BETA);
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.output_config.format.schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['title', 'score'],
    });
  });

  it('streams Haiku through the plain endpoint, without fallback', async () => {
    const { llm, captured } = setup(['{"title":"Lua","score":3}']);
    await llm.generate(request('claude-haiku-5-5'));
    const { body, headers } = captured[0]!;
    expect(body.stream).toBe(true);
    expect(body).not.toHaveProperty('fallbacks');
    expect(headers.get('anthropic-beta') ?? '').not.toContain(FALLBACK_BETA);
  });

  it('reports a schema violation as a retryable invalid_output, with the issues', async () => {
    const { llm } = setup(['{"title":"A very long title","score":8}']);
    const error = await llm.generate(request('claude-opus-5-5')).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LlmInvalidOutputError);
    expect(error).toMatchObject({ kind: 'invalid_output', retryable: true });
    expect((error as LlmInvalidOutputError).issues[0]).toMatch(/^- title: /);
  });

  it('reports a cut answer as truncated', async () => {
    const { llm } = setup(['{"title":"Lu'], 'max_tokens');
    await expect(llm.generate(request('claude-opus-5-5'))).rejects.toThrow(LlmTruncatedError);
  });

  it('joins two text blocks, as a mid-stream fallback leaves them', async () => {
    const { llm } = setup(['{"title":"Lu', 'a","score":8}']);
    const result = await llm.generate(request('claude-opus-5-5'));
    expect(result.data).toEqual({ title: 'Lua', score: 8 });
  });
});
