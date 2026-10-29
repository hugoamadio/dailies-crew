import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export const KEY_NAMES = ['anthropic', 'elevenlabs'] as const;
export type KeyName = (typeof KEY_NAMES)[number];
export type KeyCheck = { state: 'ok' | 'refused' | 'missing' | 'error'; detail?: string };
/** Calls a free endpoint of a provider with the key */
export type Probe = (key: string) => Promise<KeyCheck>;

const ENV_NAMES: Record<KeyName, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  elevenlabs: 'ELEVENLABS_API_KEY',
};

/** What the settings page may say about the keys: whether they exist, never their values */
export function keyStatus(env: Record<string, string | undefined>) {
  return {
    anthropic: Boolean(env.ANTHROPIC_API_KEY),
    elevenlabs: Boolean(env.ELEVENLABS_API_KEY),
    fakeAi: env.DAILIES_FAKE_AI === '1',
    realVoice: env.DAILIES_REAL_VOICE === '1',
  };
}

/** A message from a failed check, with the key cut out in case a provider ever echoes it */
function detailOf(error: unknown, key: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(key).join('***').slice(0, 200);
}

/**
 * Claude: models.list is free; 401 and 403 mean the key is refused. The address is fixed: the
 * key must never go to whatever ANTHROPIC_BASE_URL (or an auth token variable) points at.
 */
export function anthropicProbe(fetchImpl?: typeof fetch): Probe {
  return async (key) => {
    const client = new Anthropic({
      apiKey: key,
      authToken: null,
      baseURL: 'https://api.anthropic.com',
      maxRetries: 0,
      timeout: 15_000,
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
    });
    try {
      await client.models.list({ limit: 1 });
      return { state: 'ok' };
    } catch (error) {
      if (
        error instanceof Anthropic.AuthenticationError ||
        error instanceof Anthropic.PermissionDeniedError
      ) {
        return { state: 'refused' };
      }
      return { state: 'error', detail: detailOf(error, key) };
    }
  };
}

/** ElevenLabs: the user endpoint is free; 401 and 403 mean the key is refused */
export function elevenLabsProbe(fetchImpl: typeof fetch = fetch): Probe {
  return async (key) => {
    try {
      const response = await fetchImpl('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': key },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return { state: 'ok' };
      if (response.status === 401 || response.status === 403) return { state: 'refused' };
      return { state: 'error', detail: `HTTP ${response.status}` };
    } catch (error) {
      return { state: 'error', detail: detailOf(error, key) };
    }
  };
}

/** "Check keys": each configured key against its provider's free endpoint, nowhere else */
export async function checkKeys(
  env: Record<string, string | undefined>,
  probes: Record<KeyName, Probe> = { anthropic: anthropicProbe(), elevenlabs: elevenLabsProbe() },
): Promise<Record<KeyName, KeyCheck>> {
  const entries = await Promise.all(
    KEY_NAMES.map(async (name) => {
      const key = env[ENV_NAMES[name]];
      return [name, key ? await probes[name](key) : { state: 'missing' }] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<KeyName, KeyCheck>;
}
