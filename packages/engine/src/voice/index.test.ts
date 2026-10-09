import { describe, expect, it } from 'vitest';
import { createVoiceProvider, ElevenLabsVoiceProvider, FakeVoiceProvider } from './index';

describe('createVoiceProvider', () => {
  it('builds the fake provider without any key', () => {
    expect(createVoiceProvider('fake', {})).toBeInstanceOf(FakeVoiceProvider);
  });
  it('needs ELEVENLABS_API_KEY for ElevenLabs', () => {
    expect(() => createVoiceProvider('elevenlabs', {})).toThrow('ELEVENLABS_API_KEY is not set');
    expect(createVoiceProvider('elevenlabs', { ELEVENLABS_API_KEY: 'k' })).toBeInstanceOf(
      ElevenLabsVoiceProvider,
    );
  });
});
