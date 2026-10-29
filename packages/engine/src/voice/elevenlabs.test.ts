import { describe, expect, it, vi } from 'vitest';
import { ElevenLabsVoiceProvider } from './elevenlabs';
import { VoiceProviderError } from './types';

const KEY = 'secret-key-123';

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

const okBody = {
  audio_base64: Buffer.from('fake-mp3').toString('base64'),
  alignment: {
    characters: [...'Oi já'],
    character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4],
    character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5],
  },
};

describe('ElevenLabsVoiceProvider', () => {
  it('asks for audio with timestamps and turns them into words', async () => {
    const fetch = respond(200, okBody);
    const provider = new ElevenLabsVoiceProvider({ apiKey: KEY, fetch });
    const result = await provider.synthesize({
      text: 'Oi já',
      voiceId: 'voice 1',
      language: 'pt-BR',
      previousText: 'Antes.',
      nextText: 'Depois.',
    });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/voice%201/with-timestamps?output_format=mp3_44100_128',
    );
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'xi-api-key': KEY, 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({
      text: 'Oi já',
      model_id: 'eleven_multilingual_v2',
      previous_text: 'Antes.',
      next_text: 'Depois.',
    });
    expect(new TextDecoder().decode(result.audio)).toBe('fake-mp3');
    expect(result).toMatchObject({
      extension: 'mp3',
      characters: 5,
      durationSeconds: 0.65,
      words: [
        { text: 'Oi', startSeconds: 0, endSeconds: 0.2 },
        { text: 'já', startSeconds: 0.3, endSeconds: 0.5 },
      ],
    });
  });

  it.each([
    [
      401,
      { detail: { status: 'invalid_api_key', message: 'Invalid API key' } },
      'ElevenLabs answered 401: Invalid API key',
    ],
    [
      429,
      { detail: 'Too many concurrent requests' },
      'ElevenLabs answered 429: Too many concurrent requests',
    ],
  ])('explains an error %s without the key', async (status, body, message) => {
    const provider = new ElevenLabsVoiceProvider({ apiKey: KEY, fetch: respond(status, body) });
    const error = await provider
      .synthesize({ text: 'Oi', voiceId: 'v', language: 'pt-BR' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(VoiceProviderError);
    expect((error as Error).message).toBe(message);
    expect((error as Error).message).not.toContain(KEY);
    // a refused key will not get better by retrying; a rate limit will
    expect(error).toMatchObject({ status, retryable: status === 429 });
  });

  it('explains a network failure', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const provider = new ElevenLabsVoiceProvider({ apiKey: KEY, fetch });
    await expect(
      provider.synthesize({ text: 'Oi', voiceId: 'v', language: 'pt-BR' }),
    ).rejects.toThrow('Could not reach ElevenLabs: fetch failed');
    await expect(
      provider.synthesize({ text: 'Oi', voiceId: 'v', language: 'pt-BR' }),
    ).rejects.toMatchObject({ status: null, retryable: true });
  });

  it('classifies an unreadable answer body as retryable, without a status', async () => {
    const broken = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('The operation was aborted due to timeout')),
    });
    const notJson = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }));
    for (const fetch of [broken, notJson]) {
      const provider = new ElevenLabsVoiceProvider({ apiKey: KEY, fetch });
      const error = await provider
        .synthesize({ text: 'Oi', voiceId: 'v', language: 'pt-BR' })
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(VoiceProviderError);
      expect(error).toMatchObject({ status: null, retryable: true });
    }
  });

  it('refuses an answer without timings', async () => {
    const provider = new ElevenLabsVoiceProvider({
      apiKey: KEY,
      fetch: respond(200, { audio_base64: okBody.audio_base64 }),
    });
    await expect(
      provider.synthesize({ text: 'Oi', voiceId: 'v', language: 'pt-BR' }),
    ).rejects.toThrow('ElevenLabs sent no timing for the voice');
  });

  it('refuses a malformed alignment with a plain, non-retryable error', async () => {
    for (const alignment of [
      {},
      { characters: ['O', 'i'] },
      {
        characters: ['O', 'i'],
        character_start_times_seconds: [0],
        character_end_times_seconds: [1],
      },
      {
        characters: 'Oi',
        character_start_times_seconds: [0, 1],
        character_end_times_seconds: [1, 2],
      },
    ]) {
      const provider = new ElevenLabsVoiceProvider({
        apiKey: KEY,
        fetch: respond(200, { audio_base64: okBody.audio_base64, alignment }),
      });
      const error = await provider
        .synthesize({ text: 'Oi', voiceId: 'v', language: 'pt-BR' })
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(VoiceProviderError);
      expect(error).toMatchObject({ retryable: false });
    }
  });
});
