import { alignmentToWords } from './alignment';
import {
  type SynthesisRequest,
  type SynthesisResult,
  type VoiceProvider,
  VoiceProviderError,
} from './types';

export const ELEVENLABS_DEFAULT_MODEL = 'eleven_multilingual_v2';

interface Options {
  apiKey: string;
  modelId?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** A request that takes longer fails as a network error (retryable). Default 120 s */
  timeoutMs?: number;
}

interface TimestampsResponse {
  audio_base64?: string;
  alignment?: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  } | null;
}

/** ElevenLabs text to speech with character timestamps (best voices; paid per character) */
export class ElevenLabsVoiceProvider implements VoiceProvider {
  readonly name = 'elevenlabs';
  readonly cacheKey: string;
  private readonly apiKey: string;
  private readonly modelId: string;
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: Options) {
    this.apiKey = options.apiKey;
    this.modelId = options.modelId ?? ELEVENLABS_DEFAULT_MODEL;
    this.cacheKey = `elevenlabs:${this.modelId}`;
    this.baseUrl = (options.baseUrl ?? 'https://api.elevenlabs.io').replace(/\/+$/, '');
    this.fetch = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async synthesize(request: SynthesisRequest): Promise<SynthesisResult> {
    const url = `${this.baseUrl}/v1/text-to-speech/${encodeURIComponent(request.voiceId)}/with-timestamps?output_format=mp3_44100_128`;
    let response: Response;
    try {
      response = await this.fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: {
          'xi-api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          text: request.text,
          model_id: this.modelId,
          ...(request.previousText ? { previous_text: request.previousText } : {}),
          ...(request.nextText ? { next_text: request.nextText } : {}),
        }),
      });
    } catch (error) {
      throw new VoiceProviderError(
        `Could not reach ElevenLabs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) {
      throw new VoiceProviderError(
        `ElevenLabs answered ${response.status}: ${await errorDetail(response)}`,
        response.status,
        response.status === 429 || response.status >= 500,
      );
    }
    let body: TimestampsResponse;
    try {
      body = (await response.json()) as TimestampsResponse;
    } catch (error) {
      // the body timed out halfway or is not JSON: nothing was received, trying again can help
      throw new VoiceProviderError(
        `ElevenLabs sent an unreadable answer: ${error instanceof Error ? error.message : String(error)}`,
        null,
        true,
      );
    }
    const alignment = body?.alignment;
    if (!body?.audio_base64 || !alignment || alignment.characters?.length === 0) {
      throw new VoiceProviderError('ElevenLabs sent no timing for the voice');
    }
    const lists = [
      alignment.characters,
      alignment.character_start_times_seconds,
      alignment.character_end_times_seconds,
    ];
    if (!lists.every((list) => Array.isArray(list) && list.length === lists[0]!.length)) {
      throw new VoiceProviderError('ElevenLabs sent a malformed timing for the voice', null, false);
    }
    const words = alignmentToWords(
      alignment.characters,
      alignment.character_start_times_seconds,
      alignment.character_end_times_seconds,
    );
    const lastEnd = Math.max(0, ...alignment.character_end_times_seconds);
    return {
      audio: new Uint8Array(Buffer.from(body.audio_base64, 'base64')),
      extension: 'mp3',
      words,
      durationSeconds: Math.round((lastEnd + 0.15) * 1000) / 1000,
      characters: request.text.length,
    };
  }
}

async function errorDetail(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    const detail = parsed.detail;
    if (typeof detail === 'string') return detail.slice(0, 200);
    if (detail && typeof detail === 'object' && 'message' in detail) {
      return String((detail as { message: unknown }).message).slice(0, 200);
    }
  } catch {
    // not JSON: fall through to the raw text
  }
  return text.slice(0, 200) || response.statusText;
}
