import { describe, expect, it } from 'vitest';
import { FakeVoiceProvider } from './fake';

describe('FakeVoiceProvider', () => {
  it('returns a silent WAV as long as the fake word timings', async () => {
    const result = await new FakeVoiceProvider().synthesize({
      text: 'Olá mundo',
      voiceId: 'any',
      language: 'pt-BR',
    });
    expect(result.extension).toBe('wav');
    expect(result.durationSeconds).toBe(0.92);
    expect(result.characters).toBe(9);
    expect(result.words.map((word) => word.text)).toEqual(['Olá', 'mundo']);
    const header = new TextDecoder().decode(result.audio.slice(0, 12));
    expect(header.slice(0, 4)).toBe('RIFF');
    expect(header.slice(8, 12)).toBe('WAVE');
    expect(result.audio.length).toBe(44 + Math.round(0.92 * 22050) * 2);
  });
});
