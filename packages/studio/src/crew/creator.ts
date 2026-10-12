import { z } from 'zod';
import type { LlmRequest } from '../llm/types';
import type { RoleConfig } from '../settings/schema';
import {
  clip,
  joinSections,
  type Material,
  materialSection,
  type Recipe,
  recipeSection,
  rulesSection,
  subjectOf,
} from './context';
import type { Briefing } from './preparer';

export const CREATOR_STYLES = ['funny', 'emotional', 'demonstration'] as const;
export type CreatorStyle = (typeof CREATOR_STYLES)[number];
export const IDEAS_PER_CREATOR = 2;

export const IdeaSchema = z.strictObject({
  title: z.string().min(3).max(80),
  /** What the viewer sees and hears in the first 3 seconds */
  hook: z.string().min(3).max(160),
  angle: z.string().min(3).max(300),
  /** The beats of the video, in order */
  structure: z.array(z.string().min(3).max(160)).min(3).max(6),
  cta: z.string().min(2).max(80),
});
export type IdeaDraft = z.output<typeof IdeaSchema>;

export const CreatorOutputSchema = z.strictObject({
  ideas: z.array(IdeaSchema).length(IDEAS_PER_CREATOR),
});
export type CreatorOutput = z.output<typeof CreatorOutputSchema>;

export interface CreateFacts {
  style: CreatorStyle;
  recipe: Recipe;
  rules: string[];
  material: Material;
  briefing: Briefing;
  /** Titles of ideas this line already used for the same subject: never repeat them */
  usedIdeas: string[];
}

const STYLE_NOTES: Record<CreatorStyle, string> = {
  funny:
    'Your style is FUNNY: a twist, a relatable situation, light humor that never mocks the audience.',
  emotional:
    'Your style is EMOTIONAL: a feeling, a small story, a moment the viewer recognizes from their own life.',
  demonstration:
    'Your style is DEMONSTRATION: show the thing working, the detail that convinces, before and after.',
};

function system(style: CreatorStyle): string {
  return `You are a creator in a crew that makes short vertical videos (15 to 60 seconds) for TikTok, Reels, Shorts and Facebook.
${STYLE_NOTES[style]}
Propose exactly ${IDEAS_PER_CREATOR} different ideas for today's video. Every idea has:
- title: a short name for the idea;
- hook: what grabs the viewer in the first 3 seconds (a question, a surprising statement, a striking image);
- angle: why this idea fits the objective and the audience;
- structure: 3 to 6 beats, in order, that a scriptwriter can turn into narration;
- cta: the call to action at the end.
Use only the facts of the briefing and the material. Write hook, structure and cta in the line's language; title and angle in English.`;
}

export function buildCreateRequest(
  facts: CreateFacts,
  role: RoleConfig,
): LlmRequest<CreatorOutput> {
  const used = facts.usedIdeas.length
    ? [
        '## Ideas already used (never repeat them)',
        ...facts.usedIdeas.map((title) => `- ${title}`),
      ].join('\n')
    : '';
  return {
    role: 'creator',
    model: role.model,
    effort: role.effort,
    system: system(facts.style),
    content: [
      {
        type: 'text',
        text: joinSections(
          recipeSection(facts.recipe),
          materialSection(facts.material, facts.recipe.language),
          `## Briefing\n${JSON.stringify(facts.briefing, null, 2)}`,
          rulesSection(facts.rules),
          used,
          `Propose your ${IDEAS_PER_CREATOR} ideas.`,
        ),
      },
    ],
    schema: CreatorOutputSchema,
    maxTokens: 16000,
    facts,
  };
}

export function fakeIdeas(facts: CreateFacts): CreatorOutput {
  const subject = clip(subjectOf(facts.material), 40);
  const idea = (index: number): IdeaDraft => ({
    title: clip(`${facts.style} ${index}: ${subject}`, 80),
    hook: clip(`Have you ever seen ${subject} like this?`, 160),
    angle: clip(`A ${facts.style} take on ${subject} for ${facts.recipe.audience}`, 300),
    structure: [`A question about ${subject}`, `${subject} up close`, 'The call to action'].map(
      (beat) => clip(beat, 160),
    ),
    cta: 'Link in bio',
  });
  return { ideas: [idea(1), idea(2)] };
}
