import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plan, VoiceTrack, Word } from '@dailies-crew/plan';
import type { VoiceProvider } from './voice';

interface CacheEntry {
  /** The audio file, relative to the cache file's folder */
  file: string;
  words: Word[];
  durationSeconds: number;
}

type CacheIndex = Record<string, CacheEntry>;

/** The same text, voice and provider always sound the same: one paid synthesis is enough */
function cacheKey(provider: VoiceProvider, voiceId: string, language: string, text: string) {
  const parts = [provider.name, provider.cacheKey ?? '', voiceId, language, text];
  return createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 32);
}

async function readIndex(cacheFile: string): Promise<CacheIndex> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as CacheIndex)
      : {};
  } catch {
    return {};
  }
}

/** An entry is only reused when it is whole; anything else is a miss and the line is made again */
async function usableEntry(entry: unknown, cacheDir: string): Promise<CacheEntry | null> {
  if (!entry || typeof entry !== 'object') return null;
  const { file, words, durationSeconds } = entry as Partial<CacheEntry>;
  if (typeof file !== 'string' || !Array.isArray(words)) return null;
  if (typeof durationSeconds !== 'number' || !Number.isFinite(durationSeconds)) return null;
  const size = await fs.stat(path.join(cacheDir, file)).then(
    (stat) => (stat.isFile() ? stat.size : 0),
    () => 0,
  );
  return size > 0 ? { file, words, durationSeconds } : null;
}

/** Written under a temporary name and renamed, so a crash never leaves half an index */
async function writeIndex(cacheFile: string, index: CacheIndex): Promise<void> {
  const temporary = `${cacheFile}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(index, null, 2));
  await fs.rename(temporary, cacheFile);
}

export interface SynthesisOutcome {
  tracks: VoiceTrack[];
  /** Characters synthesized now: what the provider bills */
  characters: number;
  /** Characters reused from the cache: nothing to pay */
  cachedCharacters: number;
}

/**
 * One audio file per voice line, one line at a time (providers limit concurrent requests). With
 * a cache file, every synthesized line is kept next to it (voice-cache/<key>.<ext>) and indexed
 * at once, so a retry after any failure never pays for the same line twice.
 */
export async function synthesizeVoice(
  plan: Plan,
  provider: VoiceProvider,
  publicDir: string,
  options: { cacheFile?: string; signal?: AbortSignal } = {},
): Promise<SynthesisOutcome> {
  const { lines } = plan.voice;
  const tracks: VoiceTrack[] = [];
  let characters = 0;
  let cachedCharacters = 0;
  await fs.mkdir(path.join(publicDir, 'voice'), { recursive: true });
  const cacheFile = options.cacheFile;
  const cacheDir = cacheFile ? path.dirname(cacheFile) : null;
  const index = cacheFile ? await readIndex(cacheFile) : {};

  for (const [position, line] of lines.entries()) {
    options.signal?.throwIfAborted();
    const key = cacheKey(provider, plan.voice.voiceId, plan.voice.language, line.text);
    const cached = cacheDir ? await usableEntry(index[key], cacheDir) : null;
    if (cacheDir && cached) {
      const src = `voice/${line.id}${path.extname(cached.file)}`;
      await fs.copyFile(path.join(cacheDir, cached.file), path.join(publicDir, src));
      tracks.push({
        lineId: line.id,
        src,
        words: cached.words,
        durationSeconds: cached.durationSeconds,
      });
      cachedCharacters += line.text.length;
      continue;
    }
    const result = await provider.synthesize({
      text: line.text,
      voiceId: plan.voice.voiceId,
      language: plan.voice.language,
      previousText: lines[position - 1]?.text,
      nextText: lines[position + 1]?.text,
    });
    const src = `voice/${line.id}.${result.extension}`;
    await fs.writeFile(path.join(publicDir, src), result.audio);
    if (cacheFile && cacheDir) {
      const file = `voice-cache/${key}.${result.extension}`;
      await fs.mkdir(path.join(cacheDir, 'voice-cache'), { recursive: true });
      await fs.writeFile(path.join(cacheDir, file), result.audio);
      index[key] = { file, words: result.words, durationSeconds: result.durationSeconds };
      await writeIndex(cacheFile, index);
    }
    tracks.push({
      lineId: line.id,
      src,
      words: result.words,
      durationSeconds: result.durationSeconds,
    });
    characters += result.characters;
  }
  return { tracks, characters, cachedCharacters };
}
