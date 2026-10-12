import { z } from 'zod';
import type { LlmContent, LlmRequest } from '../llm/types';
import type { RoleConfig } from '../settings/schema';
import {
  type Instruction,
  joinSections,
  type Material,
  materialSection,
  type Recipe,
  recipeSection,
  REWORK_STAGES,
  type ReworkStage,
  rulesSection,
} from './context';
import type { IdeaDraft } from './creator';
import type { Script } from './scriptwriter';

export const REVIEW_FOCUSES = ['art', 'rhythm', 'fidelity'] as const;
export type ReviewFocus = (typeof REVIEW_FOCUSES)[number];
/** Rounds of review changes before the video goes to Hugo as "needs you" */
export const MAX_REVIEW_ROUNDS = 2;
/** Frames sent to each reviewer at most (a 60 s video at 2 per second makes 120) */
export const MAX_REVIEW_FRAMES = 100;

export const ReviewSchema = z.strictObject({
  verdict: z.enum(['approve', 'adjust']),
  notes: z.string().min(3).max(1000),
  adjustments: z
    .array(
      z.strictObject({
        stage: z.enum(REWORK_STAGES),
        instruction: z.string().min(3).max(400),
      }),
    )
    .max(6),
});
export type Review = z.output<typeof ReviewSchema>;

export interface SceneRow {
  id: string;
  piece: string;
  startSeconds: number;
  seconds: number;
  lineId: string | null;
  transitionOut: string | null;
}

export interface VoiceRow {
  lineId: string;
  text: string;
  startSeconds: number;
  seconds: number;
}

export interface ReviewFacts {
  focus: ReviewFocus;
  recipe: Recipe;
  rules: string[];
  material: Material;
  idea: IdeaDraft;
  script: Script;
  directorNotes: string;
  totalSeconds: number;
  scenes: SceneRow[];
  voice: VoiceRow[];
  /** When each frame sent was taken, in seconds */
  frameSeconds: number[];
}

const FOCUS_NOTES: Record<ReviewFocus, string> = {
  art: 'ART: colors and contrast, legibility of every text, nothing cut or covered, nothing important in the areas the apps cover (top, right edge, bottom), pleasant composition.',
  rhythm:
    'RHYTHM: does the hook land in the first 3 seconds, do scenes last the right time, do transitions feel intentional, does each scene match the line being spoken (see the scene table and the voice timings)?',
  fidelity:
    "FIDELITY: is it the approved idea, does it serve the line's objective, are the name, the price and every fact of the material correct and never invented?",
};

/** Identical for the three reviewers, so the frames are cached once and read three times */
const SYSTEM = `You are a reviewer in the quality-control crew of a team that makes short vertical videos.
You watch the video through frames taken twice per second, read the plan, and judge it on the focus you are given.
Answer "approve" when the video is ready to publish for your focus. Answer "adjust" only for problems a viewer would notice, and give each problem as an adjustment for the stage that can fix it:
- "script": the narration (what is said, the hook, the length);
- "direction": the scenes (pieces, texts on screen, photos, camera, transitions, timing);
- "produce": the voice take or a rendering glitch (a new voice take is generated).
Write notes and instructions in English, precise enough for the stage to act on.`;

export function buildReviewRequest(
  facts: ReviewFacts,
  frames: readonly string[],
  role: RoleConfig,
): LlmRequest<Review> {
  const context = joinSections(
    recipeSection(facts.recipe),
    materialSection(facts.material, facts.recipe.language),
    rulesSection(facts.rules),
    `## The approved idea\n${JSON.stringify(facts.idea, null, 2)}`,
    `## The script\n${JSON.stringify(facts.script.lines, null, 2)}`,
    `## The director's notes\n${facts.directorNotes}`,
    `## Scenes (the video lasts ${facts.totalSeconds.toFixed(1)} s)\n${JSON.stringify(facts.scenes, null, 2)}`,
    `## Voice lines on the timeline (captions follow the voice word by word)\n${JSON.stringify(facts.voice, null, 2)}`,
    `## Frames\n${frames.length} JPEG frames follow, in order, taken at these seconds: ${facts.frameSeconds.map((second) => second.toFixed(1)).join(', ')}`,
  );
  const images: LlmContent[] = frames.map((data, index) => ({
    type: 'image',
    mediaType: 'image/jpeg',
    data,
    ...(index === frames.length - 1 ? { cacheBreakpoint: true } : {}),
  }));
  return {
    role: 'reviewer',
    model: role.model,
    effort: role.effort,
    system: SYSTEM,
    content: [
      { type: 'text', text: context },
      ...images,
      { type: 'text', text: `Your focus: ${FOCUS_NOTES[facts.focus]}\nGive your verdict.` },
    ],
    schema: ReviewSchema,
    maxTokens: 16000,
    facts,
  };
}

export function fakeReview(facts: ReviewFacts): Review {
  return { verdict: 'approve', notes: `Fake ${facts.focus} review: approved.`, adjustments: [] };
}

/** Evenly spread picks that always keep the first and the last item */
export function sampleEvenly<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return [...items];
  return Array.from(
    { length: max },
    (_, index) => items[Math.round((index * (items.length - 1)) / (max - 1))]!,
  );
}

export type ReviewDecision =
  | { kind: 'approve' }
  | { kind: 'adjust'; from: ReworkStage; instructions: Instruction[] }
  | { kind: 'needs_you'; problems: string[] };

/**
 * Any "adjust" sends the video back to the earliest stage asked for, with every instruction,
 * while review rounds remain; after that Hugo gets it as "needs you" with the problems listed.
 */
export function decideReview(
  verdicts: Record<ReviewFocus, Review>,
  reviewRoundsUsed: number,
  maxRounds = MAX_REVIEW_ROUNDS,
): ReviewDecision {
  const instructions: Instruction[] = [];
  for (const focus of REVIEW_FOCUSES) {
    const review = verdicts[focus];
    if (review.verdict === 'approve') continue;
    const adjustments = review.adjustments.length
      ? review.adjustments
      : [{ stage: 'direction' as const, instruction: review.notes }];
    for (const adjustment of adjustments) {
      instructions.push({
        stage: adjustment.stage,
        instruction: `(${focus}) ${adjustment.instruction}`,
        source: 'review',
      });
    }
  }
  if (instructions.length === 0) return { kind: 'approve' };
  if (reviewRoundsUsed >= maxRounds) {
    return {
      kind: 'needs_you',
      problems: instructions.map((item) => `${item.stage}: ${item.instruction}`),
    };
  }
  const from = REWORK_STAGES.find((stage) => instructions.some((item) => item.stage === stage))!;
  return { kind: 'adjust', from, instructions };
}
