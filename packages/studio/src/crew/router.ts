import { z } from 'zod';
import type { LlmRequest } from '../llm/types';
import type { RoleConfig } from '../settings/schema';
import { clip, joinSections, type Recipe, recipeSection, REWORK_STAGES } from './context';

export const RouterSchema = z.strictObject({
  /** The stage that can fix what Hugo complained about */
  stage: z.enum(REWORK_STAGES),
  /** The complaint as a short imperative rule for future videos of the line */
  rule: z.string().min(3).max(200),
});
export type RouterOutput = z.output<typeof RouterSchema>;

export interface RouteFacts {
  recipe: Recipe;
  reason: string;
  ideaTitle: string | null;
  scriptLines: string[];
}

const SYSTEM = `You route Hugo's rejection of a short video. Hugo explains in his own words (usually Portuguese) what is wrong.
1. stage: which stage can fix it. "script" for the narration (what is said, the hook, the length); "direction" for the scenes (pieces, texts on screen, photos, camera, transitions); "produce" for the voice take or a rendering glitch.
2. rule: the complaint rewritten as one short imperative rule that future videos of this line must follow, in English, at most 200 characters (e.g. "Never show the price before the product").`;

export function buildRouteRequest(facts: RouteFacts, role: RoleConfig): LlmRequest<RouterOutput> {
  return {
    role: 'rejection-router',
    model: role.model,
    effort: role.effort,
    system: SYSTEM,
    content: [
      {
        type: 'text',
        text: joinSections(
          recipeSection(facts.recipe),
          ...(facts.ideaTitle ? [`## The video's idea\n${facts.ideaTitle}`] : []),
          ...(facts.scriptLines.length
            ? [`## Its narration\n${facts.scriptLines.join('\n')}`]
            : []),
          `## Hugo's reason\n${facts.reason}`,
        ),
      },
    ],
    schema: RouterSchema,
    maxTokens: 4000,
    facts,
  };
}

export function fakeRoute(facts: RouteFacts): RouterOutput {
  const reason = facts.reason.toLowerCase();
  const stage = /roteiro|script|texto|fala|narra/.test(reason)
    ? 'script'
    : /voz|voice|render|travou|glitch/.test(reason)
      ? 'produce'
      : 'direction';
  return { stage, rule: clip(`Avoid this: ${facts.reason}`, 200) };
}
