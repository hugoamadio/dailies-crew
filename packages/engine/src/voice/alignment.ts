import type { Word } from '@dailies-crew/plan';

const ms = (seconds: number) => Math.round(seconds * 1000) / 1000;

/** Character timings (what ElevenLabs returns) → word timings, splitting on whitespace */
export function alignmentToWords(
  characters: readonly string[],
  starts: readonly number[],
  ends: readonly number[],
): Word[] {
  const words: Word[] = [];
  let current: Word | null = null;
  characters.forEach((character, index) => {
    if (/\s/.test(character)) {
      current = null;
      return;
    }
    const start = starts[index] ?? 0;
    const end = ends[index] ?? start;
    if (current) {
      current.text += character;
      current.endSeconds = ms(end);
    } else {
      current = { text: character, startSeconds: ms(start), endSeconds: ms(end) };
      words.push(current);
    }
  });
  return words;
}
