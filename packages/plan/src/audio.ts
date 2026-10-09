export const DUCK_RAMP_FRAMES = 6;
/** A pause between two voice lines shorter than this keeps the music ducked (no swell in between) */
export const DUCK_HOLD_FRAMES = 20;
export const MUSIC_FADE_IN_FRAMES = 10;
export const MUSIC_FADE_OUT_FRAMES = 20;

type Span = { from: number; end: number };

/** The voice lines as spans of speech, joining two lines when the pause between them is short */
function speechSpans(voice: readonly { from: number; durationInFrames: number }[]): Span[] {
  const sorted = voice
    .map((line) => ({ from: line.from, end: line.from + line.durationInFrames }))
    .sort((a, b) => a.from - b.from);
  const spans: Span[] = [];
  for (const line of sorted) {
    const last = spans.at(-1);
    if (last && line.from - last.end < DUCK_HOLD_FRAMES) {
      last.end = Math.max(last.end, line.end);
    } else {
      spans.push({ ...line });
    }
  }
  return spans;
}

/**
 * Background-music volume at a frame of the video: full volume, lowered to duckTo while the voice
 * speaks (with a short ramp on both sides, and held through pauses shorter than DUCK_HOLD_FRAMES),
 * faded in at the start and out at the end.
 */
export function musicVolumeAt(
  frame: number,
  voice: readonly { from: number; durationInFrames: number }[],
  music: { volume: number; duckTo: number },
  totalFrames: number,
): number {
  let distance = Number.POSITIVE_INFINITY;
  for (const span of speechSpans(voice)) {
    const away =
      frame < span.from ? span.from - frame : frame >= span.end ? frame - span.end + 1 : 0;
    distance = Math.min(distance, away);
  }
  const base =
    distance >= DUCK_RAMP_FRAMES
      ? music.volume
      : music.duckTo + (music.volume - music.duckTo) * (distance / DUCK_RAMP_FRAMES);
  const fadeIn = Math.min(1, frame / MUSIC_FADE_IN_FRAMES);
  const fadeOut = Math.min(1, (totalFrames - 1 - frame) / MUSIC_FADE_OUT_FRAMES);
  return Math.max(0, base * fadeIn * fadeOut);
}
