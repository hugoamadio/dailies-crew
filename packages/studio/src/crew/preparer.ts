import { z } from 'zod';
import type { LlmRequest } from '../llm/types';
import type { RoleConfig } from '../settings/schema';
import {
  clip,
  formatPrice,
  joinSections,
  type Material,
  materialSection,
  type Recipe,
  recipeSection,
  rulesSection,
  subjectOf,
} from './context';

export const BriefingSchema = z.strictObject({
  summary: z.string().min(20).max(1500),
  keyFacts: z.array(z.string().min(1).max(200)).min(1).max(8),
  mustAvoid: z.array(z.string().min(1).max(200)).max(8),
});
export type Briefing = z.output<typeof BriefingSchema>;

export interface PrepareFacts {
  recipe: Recipe;
  rules: string[];
  material: Material;
  /** Ideas this line already turned into videos, newest first */
  recentIdeas: { title: string; hook: string }[];
  /** Hugo's reasons for the line's latest rejections */
  rejections: string[];
}

const SYSTEM = `You are the producer of a crew that makes short vertical videos (15 to 60 seconds) for TikTok, Instagram Reels, YouTube Shorts and Facebook.
Before the creative crews start, you read everything about today's video and write a short briefing for them.
- summary: what the video is about and what it must achieve, in plain words (at most 1500 characters).
- keyFacts: the facts the video may use (names, prices, features), copied exactly from the material. Never invent a fact.
- mustAvoid: what the crews must not do: the learned rules that apply, the reasons of past rejections, ideas already used.
Write the briefing in English; the crews will write the video itself in the line's language.`;

export function buildPrepareRequest(facts: PrepareFacts, role: RoleConfig): LlmRequest<Briefing> {
  const recent = facts.recentIdeas.length
    ? [
        '## Ideas already used by this line',
        ...facts.recentIdeas.map((idea) => `- ${idea.title}: ${idea.hook}`),
      ].join('\n')
    : '';
  const rejections = facts.rejections.length
    ? [
        '## Why Hugo rejected recent videos',
        ...facts.rejections.map((reason) => `- ${reason}`),
      ].join('\n')
    : '';
  return {
    role: 'preparer',
    model: role.model,
    effort: role.effort,
    system: SYSTEM,
    content: [
      {
        type: 'text',
        text: joinSections(
          recipeSection(facts.recipe),
          materialSection(facts.material, facts.recipe.language),
          rulesSection(facts.rules),
          recent,
          rejections,
          'Write the briefing.',
        ),
      },
    ],
    schema: BriefingSchema,
    maxTokens: 8000,
    facts,
  };
}

export function fakeBriefing(facts: PrepareFacts): Briefing {
  const subject = subjectOf(facts.material);
  const keyFacts = [subject];
  if (facts.material.kind === 'product') {
    keyFacts.push(
      formatPrice(facts.material.priceCents, facts.material.currency, facts.recipe.language),
    );
  }
  return {
    summary: clip(
      `A video about ${subject} for ${facts.recipe.audience}. Goal: ${facts.recipe.objective}.`,
      1500,
    ),
    keyFacts: keyFacts.map((fact) => clip(fact, 200)),
    mustAvoid: [...facts.rules, ...facts.recentIdeas.map((idea) => `Repeating "${idea.title}"`)]
      .slice(0, 8)
      .map((item) => clip(item, 200)),
  };
}
