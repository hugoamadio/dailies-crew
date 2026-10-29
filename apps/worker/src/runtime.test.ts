import { describe, expect, it } from 'vitest';
import { voiceFor } from './runtime';

describe('voiceFor', () => {
  it('uses the silent fake voice for every line with the fake AI, even without a key', () => {
    expect(voiceFor('elevenlabs', { DAILIES_FAKE_AI: '1' }).name).toBe('fake');
    expect(voiceFor('elevenlabs', { DAILIES_FAKE_AI: '1', ELEVENLABS_API_KEY: 'k' }).name).toBe(
      'fake',
    );
  });

  it('uses the real provider with the fake AI only when DAILIES_REAL_VOICE=1 says so', () => {
    expect(
      voiceFor('elevenlabs', {
        DAILIES_FAKE_AI: '1',
        DAILIES_REAL_VOICE: '1',
        ELEVENLABS_API_KEY: 'k',
      }).name,
    ).toBe('elevenlabs');
    expect(() => voiceFor('elevenlabs', { DAILIES_FAKE_AI: '1', DAILIES_REAL_VOICE: '1' })).toThrow(
      'ELEVENLABS_API_KEY is not set',
    );
  });

  it('uses the line provider with the real AI', () => {
    expect(voiceFor('elevenlabs', { ELEVENLABS_API_KEY: 'k' }).name).toBe('elevenlabs');
    expect(voiceFor('fake', {}).name).toBe('fake');
  });
});
