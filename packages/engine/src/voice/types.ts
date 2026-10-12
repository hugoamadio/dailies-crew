import type { Word } from '@dailies-crew/plan';

export interface SynthesisRequest {
  text: string;
  voiceId: string;
  /** BCP 47, e.g. "pt-BR" */
  language: string;
  /** The neighbouring lines, so the provider keeps a natural intonation across lines */
  previousText?: string;
  nextText?: string;
}

export interface SynthesisResult {
  audio: Uint8Array;
  extension: 'mp3' | 'wav';
  /** Seconds from the start of this audio file */
  words: Word[];
  durationSeconds: number;
  /** Billed characters, for the cost of the video */
  characters: number;
}

export interface VoiceProvider {
  readonly name: 'elevenlabs' | 'fake';
  synthesize(request: SynthesisRequest): Promise<SynthesisResult>;
}

export class VoiceProviderError extends Error {
  /**
   * @param status the provider's HTTP status; null when no answer came (network) or it was malformed
   * @param retryable whether trying again can help: false for a refused key or a bad request
   */
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly retryable = true,
  ) {
    super(message);
    this.name = 'VoiceProviderError';
  }
}
