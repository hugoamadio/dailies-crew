import fs from 'node:fs/promises';
import path from 'node:path';
import type { Plan, VoiceTrack } from '@dailies-crew/plan';
import type { VoiceProvider } from './voice';

/** One audio file per voice line, one line at a time (providers limit concurrent requests) */
export async function synthesizeVoice(
  plan: Plan,
  provider: VoiceProvider,
  publicDir: string,
): Promise<{ tracks: VoiceTrack[]; characters: number }> {
  const { lines } = plan.voice;
  const tracks: VoiceTrack[] = [];
  let characters = 0;
  await fs.mkdir(path.join(publicDir, 'voice'), { recursive: true });
  for (const [index, line] of lines.entries()) {
    const result = await provider.synthesize({
      text: line.text,
      voiceId: plan.voice.voiceId,
      language: plan.voice.language,
      previousText: lines[index - 1]?.text,
      nextText: lines[index + 1]?.text,
    });
    const src = `voice/${line.id}.${result.extension}`;
    await fs.writeFile(path.join(publicDir, src), result.audio);
    tracks.push({ lineId: line.id, src, words: result.words, durationSeconds: result.durationSeconds });
    characters += result.characters;
  }
  return { tracks, characters };
}
