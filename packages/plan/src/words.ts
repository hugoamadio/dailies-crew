export interface Word {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export const FAKE_WORD_SECONDS = 0.32;
export const FAKE_GAP_SECONDS = 0.08;

const ms = (seconds: number) => Math.round(seconds * 1000) / 1000;

/** Word timings of the silent test voice: predictable, so tests and the Studio demo can rely on them */
export function fakeWords(text: string): { words: Word[]; durationSeconds: number } {
  let start = 0.05;
  const words = text
    .trim()
    .split(/\s+/)
    .map((token) => {
      const word = { text: token, startSeconds: ms(start), endSeconds: ms(start + FAKE_WORD_SECONDS) };
      start += FAKE_WORD_SECONDS + FAKE_GAP_SECONDS;
      return word;
    });
  const last = words[words.length - 1];
  return { words, durationSeconds: ms((last?.endSeconds ?? 0) + 0.15) };
}
