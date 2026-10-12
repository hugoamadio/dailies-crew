import { z } from 'zod';
import type { LlmRequest } from '../llm/types';
import type { RoleConfig } from '../settings/schema';
import {
  joinSections,
  type Material,
  materialSection,
  type Recipe,
  recipeSection,
  rulesSection,
} from './context';
import type { CreatorStyle, IdeaDraft } from './creator';
import type { Briefing } from './preparer';

export const JUDGE_CRITERIA = ['objective', 'retention', 'brand'] as const;
export type JudgeCriterion = (typeof JUDGE_CRITERIA)[number];
/** An idea that loses but scores at least this sum (an average of 7 out of 10) goes to the bank */
export const BANK_MIN_TOTAL = 21;

/** The scores must cover every idea exactly once; the ids are enumerated in the JSON schema */
export function judgeSchema(ideaKeys: readonly string[]) {
  const [first, ...rest] = ideaKeys;
  if (!first) throw new Error('A judge needs at least one idea');
  return z
    .strictObject({
      scores: z.array(
        z.strictObject({
          ideaId: z.enum([first, ...rest]),
          score: z.number().int().min(0).max(10),
          reason: z.string().min(3).max(300),
        }),
      ),
    })
    .superRefine((output, context) => {
      const seen = output.scores.map((entry) => entry.ideaId);
      for (const key of ideaKeys) {
        const times = seen.filter((id) => id === key).length;
        if (times !== 1) {
          context.addIssue({
            code: 'custom',
            path: ['scores'],
            message: `idea ${key} must be scored exactly once (scored ${times} times)`,
          });
        }
      }
    });
}
export type JudgeOutput = z.output<ReturnType<typeof judgeSchema>>;

export interface CandidateIdea extends IdeaDraft {
  /** "idea-1", "idea-2"...: how the judges refer to it */
  key: string;
  style: CreatorStyle;
  /** The id of an idea taken from the bank; null for today's new ideas */
  bankedId: string | null;
}

export interface JudgeFacts {
  criterion: JudgeCriterion;
  recipe: Recipe;
  rules: string[];
  material: Material;
  briefing: Briefing;
  ideas: CandidateIdea[];
}

const CRITERION_NOTES: Record<JudgeCriterion, string> = {
  objective:
    'OBJECTIVE: does the idea achieve what the line wants (sell, gain followers, bring people to the site)?',
  retention:
    'RETENTION: does the hook stop the scroll in 3 seconds, and does the structure hold the viewer to the end?',
  brand:
    'BRAND: does the idea match the tone, the audience and the identity of the line, and its learned rules?',
};

function system(criterion: JudgeCriterion): string {
  return `You are a judge in the approval committee of a crew that makes short vertical videos.
You judge only one criterion: ${CRITERION_NOTES[criterion]}
Give every idea a score from 0 (useless) to 10 (excellent) and a one-sentence reason in English. Be demanding: a 7 must be an idea worth producing. Score every idea exactly once, by its id.`;
}

export function buildJudgeRequest(facts: JudgeFacts, role: RoleConfig): LlmRequest<JudgeOutput> {
  const ideas = facts.ideas.map(({ key, title, hook, angle, structure, cta }) => ({
    id: key,
    title,
    hook,
    angle,
    structure,
    cta,
  }));
  return {
    role: 'judge',
    model: role.model,
    effort: role.effort,
    system: system(facts.criterion),
    content: [
      {
        type: 'text',
        text: joinSections(
          recipeSection(facts.recipe),
          materialSection(facts.material, facts.recipe.language),
          `## Briefing\n${JSON.stringify(facts.briefing, null, 2)}`,
          rulesSection(facts.rules),
          `## Ideas\n${JSON.stringify(ideas, null, 2)}`,
          'Score every idea.',
        ),
      },
    ],
    schema: judgeSchema(facts.ideas.map((idea) => idea.key)),
    maxTokens: 8000,
    facts,
  };
}

/** Deterministic, different per idea and criterion, so the committee has a clear winner */
export function fakeScores(facts: JudgeFacts): JudgeOutput {
  const offset = JUDGE_CRITERIA.indexOf(facts.criterion);
  return {
    scores: facts.ideas.map((idea, index) => ({
      ideaId: idea.key,
      score: Math.max(0, 9 - ((index + offset) % 4)),
      reason: `Fake ${facts.criterion} score`,
    })),
  };
}

export interface TalliedIdea {
  key: string;
  total: number;
  scores: Record<JudgeCriterion, { score: number; reason: string }>;
}

export interface CommitteeDecision {
  winner: string;
  /** New ideas good enough to keep for another day */
  banked: string[];
  /** New ideas below BANK_MIN_TOTAL */
  discarded: string[];
  tallies: TalliedIdea[];
}

/**
 * The idea with the highest sum wins (ties go to the earliest idea). The losers that score at
 * least BANK_MIN_TOTAL go to the line's bank; ideas that came from the bank stay there.
 */
export function decideCommittee(
  ideas: readonly CandidateIdea[],
  verdicts: Record<JudgeCriterion, JudgeOutput>,
): CommitteeDecision {
  const tallies = ideas.map((idea) => {
    const scores = Object.fromEntries(
      JUDGE_CRITERIA.map((criterion) => {
        const entry = verdicts[criterion].scores.find((score) => score.ideaId === idea.key);
        if (!entry) throw new Error(`Judge ${criterion} did not score ${idea.key}`);
        return [criterion, { score: entry.score, reason: entry.reason }];
      }),
    ) as TalliedIdea['scores'];
    const total = JUDGE_CRITERIA.reduce((sum, criterion) => sum + scores[criterion].score, 0);
    return { key: idea.key, total, scores };
  });
  const winner = tallies.reduce((best, tally) => (tally.total > best.total ? tally : best));
  const losers = ideas.filter((idea) => idea.key !== winner.key && idea.bankedId === null);
  const totalOf = (key: string) => tallies.find((tally) => tally.key === key)!.total;
  return {
    winner: winner.key,
    banked: losers.filter((idea) => totalOf(idea.key) >= BANK_MIN_TOTAL).map((idea) => idea.key),
    discarded: losers.filter((idea) => totalOf(idea.key) < BANK_MIN_TOTAL).map((idea) => idea.key),
    tallies,
  };
}
