export const DUCK_RAMP_FRAMES = 6;
export const MUSIC_FADE_IN_FRAMES = 10;
export const MUSIC_FADE_OUT_FRAMES = 20;

/**
 * Background-music volume at a frame of the video: full volume, lowered to duckTo while the voice
 * speaks (with a short ramp on both sides), faded in at the start and out at the end.
 */
export function musicVolumeAt(
  frame: number,
  voice: readonly { from: number; durationInFrames: number }[],
  music: { volume: number; duckTo: number },
  totalFrames: number,
): number {
  let distance = Number.POSITIVE_INFINITY;
  for (const line of voice) {
    const end = line.from + line.durationInFrames;
    const away = frame < line.from ? line.from - frame : frame >= end ? frame - end + 1 : 0;
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
