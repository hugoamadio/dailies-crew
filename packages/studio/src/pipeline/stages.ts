import type { Stage } from '@dailies-crew/db';

/** The stages of a video, in order; each one is a queue job */
export const STAGES = [
  'prepare',
  'ideas',
  'committee',
  'script',
  'direction',
  'produce',
  'review',
  'social',
] as const satisfies readonly Stage[];

/** The stage after this one; null after the last (the video is then ready for review) */
export function nextStage(stage: Stage): Stage | null {
  return STAGES[STAGES.indexOf(stage) + 1] ?? null;
}
