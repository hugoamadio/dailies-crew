import { EngineError } from '@dailies-crew/engine/errors';
import { VoiceProviderError } from '@dailies-crew/engine/voice';
import { PlanError } from '@dailies-crew/plan';
import { describe, expect, it } from 'vitest';
import { StudioError } from '../errors';
import { LlmError } from '../llm/errors';
import { classifyFailure } from './failure';
import { nextStage } from './stages';

describe('classifyFailure', () => {
  it.each([
    [new LlmError('auth', 'refused', false), 'auth', false, true],
    [new LlmError('credit', 'no credit', false), 'credit', false, true],
    [new LlmError('overloaded', 'busy', true), 'overloaded', true, false],
    [new LlmError('refusal', 'declined', false), 'refusal', false, false],
    [
      new VoiceProviderError('ElevenLabs answered 401: bad key', 401, false),
      'voice_auth',
      false,
      true,
    ],
    [new VoiceProviderError('ElevenLabs answered 429: slow down', 429, true), 'voice', true, false],
    [new PlanError([{ path: 'scenes', message: 'too long' }]), 'plan', false, false],
    [new EngineError('asset "x.png" was not found'), 'engine', false, false],
    [new StudioError('ELEVENLABS_API_KEY is not set'), 'input', false, false],
    [new Error('connection reset'), 'unknown', true, false],
  ])('%s', (error, kind, retryable, stopsEverything) => {
    expect(classifyFailure(error)).toMatchObject({ kind, retryable, stopsEverything });
  });
});

describe('nextStage', () => {
  it('follows the order of the crews, and ends after social', () => {
    expect(nextStage('prepare')).toBe('ideas');
    expect(nextStage('produce')).toBe('review');
    expect(nextStage('social')).toBeNull();
  });
});
