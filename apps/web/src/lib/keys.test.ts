import { afterEach, describe, expect, it, vi } from 'vitest';
import { anthropicProbe, checkKeys, elevenLabsProbe, keyStatus } from './keys';

const KEY = 'sk-ant-test-0000';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('keyStatus', () => {
  it('says only whether each key exists', () => {
    expect(keyStatus({ ANTHROPIC_API_KEY: KEY, DAILIES_FAKE_AI: '1' })).toEqual({
      anthropic: true,
      elevenlabs: false,
      fakeAi: true,
      realVoice: false,
    });
  });
});

describe('checkKeys', () => {
  it('calls the probe of each configured key only', async () => {
    const anthropic = vi.fn(async () => ({ state: 'ok' as const }));
    const elevenlabs = vi.fn(async () => ({ state: 'ok' as const }));
    expect(await checkKeys({ ANTHROPIC_API_KEY: KEY }, { anthropic, elevenlabs })).toEqual({
      anthropic: { state: 'ok' },
      elevenlabs: { state: 'missing' },
    });
    expect(anthropic).toHaveBeenCalledWith(KEY);
    expect(elevenlabs).not.toHaveBeenCalled();
  });
});

describe('anthropicProbe (faked HTTP, no network)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('targets api.anthropic.com even when the environment points elsewhere', async () => {
    vi.stubEnv('ANTHROPIC_BASE_URL', 'https://evil.example');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', 'token-from-env');
    const seen: { url: string; headers: Headers }[] = [];
    const probe = anthropicProbe(async (input, init) => {
      seen.push({
        url: String(input instanceof Request ? input.url : input),
        headers: new Headers(init?.headers),
      });
      return json(200, { data: [], has_more: false, first_id: null, last_id: null });
    });
    expect(await probe(KEY)).toEqual({ state: 'ok' });
    expect(seen[0]?.url).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/models/);
    expect(seen[0]?.headers.get('authorization')).toBeNull();
  });

  it('reads models.list: ok, refused on 401, an error otherwise', async () => {
    const calls: string[] = [];
    const ok = anthropicProbe(async (input) => {
      calls.push(String(input instanceof Request ? input.url : input));
      return json(200, { data: [], has_more: false, first_id: null, last_id: null });
    });
    expect(await ok(KEY)).toEqual({ state: 'ok' });
    expect(calls[0]).toMatch(/^https:\/\/api\.anthropic\.com\/v1\/models\?limit=1$/);
    const refused = anthropicProbe(async () =>
      json(401, {
        type: 'error',
        error: { type: 'authentication_error', message: 'invalid x-api-key' },
      }),
    );
    expect(await refused(KEY)).toEqual({ state: 'refused' });
    const down = anthropicProbe(async () =>
      json(529, {
        type: 'error',
        error: { type: 'overloaded_error', message: `Overloaded ${KEY}` },
      }),
    );
    const result = await down(KEY);
    expect(result.state).toBe('error');
    expect(result.detail).not.toContain(KEY);
    expect(result.detail).toContain('***');
  });
});

describe('elevenLabsProbe (faked HTTP, no network)', () => {
  it('reads the user endpoint with the key header', async () => {
    const seen: Headers[] = [];
    const probe = (status: number) =>
      elevenLabsProbe(async (_input, init) => {
        seen.push(new Headers(init?.headers));
        return json(status, {});
      });
    expect(await probe(200)(KEY)).toEqual({ state: 'ok' });
    expect(seen[0]?.get('xi-api-key')).toBe(KEY);
    expect(await probe(401)(KEY)).toEqual({ state: 'refused' });
    expect(await probe(500)(KEY)).toEqual({ state: 'error', detail: 'HTTP 500' });
  });
});
