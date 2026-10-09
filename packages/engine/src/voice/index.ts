import { ElevenLabsVoiceProvider } from './elevenlabs';
import { FakeVoiceProvider } from './fake';
import type { VoiceProvider } from './types';

export * from './alignment';
export * from './elevenlabs';
export * from './fake';
export * from './types';
export * from './wav';

export function createVoiceProvider(
  name: 'elevenlabs' | 'fake',
  env: Record<string, string | undefined>,
): VoiceProvider {
  if (name === 'fake') return new FakeVoiceProvider();
  const apiKey = env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set: put it in the .env file or use the fake voice');
  }
  return new ElevenLabsVoiceProvider({ apiKey, modelId: env.ELEVENLABS_MODEL_ID });
}
