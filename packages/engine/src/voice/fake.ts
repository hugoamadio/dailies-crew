import { fakeWords } from '@dailies-crew/plan';
import type { SynthesisRequest, SynthesisResult, VoiceProvider } from './types';
import { silentWav } from './wav';

/** Silent voice with predictable timings: tests, CI and dry runs never pay for a voice */
export class FakeVoiceProvider implements VoiceProvider {
  readonly name = 'fake';

  async synthesize({ text }: SynthesisRequest): Promise<SynthesisResult> {
    const { words, durationSeconds } = fakeWords(text);
    return {
      audio: silentWav(durationSeconds),
      extension: 'wav',
      words,
      durationSeconds,
      characters: text.length,
    };
  }
}
