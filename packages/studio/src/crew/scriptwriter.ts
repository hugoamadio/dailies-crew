import { Slug } from '@dailies-crew/plan';
import { z } from 'zod';
import type { LlmRequest } from '../llm/types';
import type { RoleConfig } from '../settings/schema';
import {
  clip,
  firstWords,
  formatPrice,
  instructionsSection,
  joinSections,
  type Material,
  materialSection,
  type Recipe,
  recipeSection,
  rulesSection,
  subjectOf,
} from './context';
import type { IdeaDraft } from './creator';
import type { Briefing } from './preparer';

export const ScriptSchema = z
  .strictObject({
    lines: z
      .array(
        z.strictObject({
          /** Lowercase words joined by dashes: the director ties scenes to lines by it */
          id: Slug,
          /** Exactly what the voice says */
          text: z.string().min(1).max(220),
          purpose: z.string().min(3).max(120),
          estimatedSeconds: z.number().min(0.5).max(10),
        }),
      )
      .min(3)
      .max(10),
    notes: z.string().max(500),
  })
  .superRefine((script, context) => {
    const ids = script.lines.map((line) => line.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', path: ['lines'], message: 'line ids must be unique' });
    }
    const total = script.lines.reduce((sum, line) => sum + line.estimatedSeconds, 0);
    if (total < 12 || total > 55) {
      context.addIssue({
        code: 'custom',
        path: ['lines'],
        message: `the narration lasts about ${total.toFixed(1)} s; it must last 12 to 55 s`,
      });
    }
  });
export type Script = z.output<typeof ScriptSchema>;

export interface ScriptFacts {
  recipe: Recipe;
  rules: string[];
  material: Material;
  briefing: Briefing;
  idea: IdeaDraft;
  /** Change requests of this round */
  instructions: string[];
  /** The script being reworked, on a new round */
  previousScript: Script | null;
}

const SYSTEM = `You are the scriptwriter of a crew that makes short vertical videos (15 to 60 seconds) for TikTok, Reels, Shorts and Facebook.
Turn the chosen idea into the narration an AI voice will read, split into lines. Each line becomes one scene with its own visual, so:
- one idea per line; 3 to 10 lines; every line under 8 seconds when spoken (about 20 words at most);
- the first line is the hook and must grab the viewer in under 3 seconds; the last line is the call to action;
- the whole narration lasts 15 to 50 seconds (count about 2.5 words per second);
- write for the ear: short sentences, numbers and prices the way people say them;
- use only facts from the briefing and the material; never invent features, prices or claims.
Each line has an id (lowercase words joined by dashes, e.g. "hook", "price", "cta"), its exact text in the line's language, its purpose (in English) and its estimated seconds.`;

export function buildScriptRequest(facts: ScriptFacts, role: RoleConfig): LlmRequest<Script> {
  const previous = facts.previousScript
    ? `## The previous version of the script (change what the requests ask, keep the rest)\n${JSON.stringify(facts.previousScript.lines, null, 2)}`
    : '';
  return {
    role: 'scriptwriter',
    model: role.model,
    effort: role.effort,
    system: SYSTEM,
    content: [
      {
        type: 'text',
        text: joinSections(
          recipeSection(facts.recipe),
          materialSection(facts.material, facts.recipe.language),
          `## Briefing\n${JSON.stringify(facts.briefing, null, 2)}`,
          `## The chosen idea\n${JSON.stringify(facts.idea, null, 2)}`,
          rulesSection(facts.rules),
          previous,
          instructionsSection(facts.instructions),
          'Write the script.',
        ),
      },
    ],
    schema: ScriptSchema,
    maxTokens: 16000,
    facts,
  };
}

/** Five lines of 6 to 12 words: about 20 s with the fake voice, every line within its piece */
export function fakeScript(facts: ScriptFacts): Script {
  const subject = clip(subjectOf(facts.material), 40);
  const line = (id: string, text: string, purpose: string) => {
    const spoken = firstWords(text, 12);
    return {
      id,
      text: spoken,
      purpose,
      estimatedSeconds: Math.round(spoken.split(' ').length * 0.4 * 10) / 10 + 0.5,
    };
  };
  const middle =
    facts.material.kind === 'product'
      ? [
          line('hero', `This is ${subject}, made with care for your home.`, 'present the product'),
          line(
            'detail',
            `Look at the details: ${firstWords(facts.material.description, 7)}`,
            'show a detail',
          ),
          line(
            'price',
            `Today it costs only ${formatPrice(facts.material.priceCents, facts.material.currency, facts.recipe.language)}.`,
            'reveal the price',
          ),
        ]
      : facts.idea.structure
          .slice(0, 3)
          .map((beat, index) =>
            line(`point-${index + 1}`, `${beat}, and here is why it matters.`, 'develop the idea'),
          );
  return {
    lines: [
      line('hook', facts.idea.hook, 'stop the scroll'),
      ...middle,
      line('cta', `${facts.idea.cta}. Follow us for more.`, 'call to action'),
    ],
    notes: 'Fake script',
  };
}
