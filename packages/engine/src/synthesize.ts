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
function cacheKey(provider: string, voiceId: string, text: string): string {
  return createHash('sha256').update(`${provider}\n${voiceId}\n${text}`).digest('hex').slice(0, 32);
}

async function readIndex(cacheFile: string): Promise<CacheIndex> {
  try {
    return JSON.parse(await fs.readFile(cacheFile, 'utf8')) as CacheIndex;
  } catch {
    return {};
  }
}

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(
    () => true,
    () => false,
  );
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
  options: { cacheFile?: string } = {},
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
    const key = cacheKey(provider.name, plan.voice.voiceId, line.text);
    const cached = index[key];
    if (cacheDir && cached && (await exists(path.join(cacheDir, cached.file)))) {
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
      await fs.writeFile(cacheFile, JSON.stringify(index, null, 2));
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
