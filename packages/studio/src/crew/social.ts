import { z } from 'zod';
import { stripAccents } from '../assets';
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
import type { IdeaDraft } from './creator';
import type { Script } from './scriptwriter';

export const SOCIAL_NETWORKS = ['youtube', 'tiktok', 'instagram', 'facebook'] as const;

const PostSchema = z.strictObject({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(2200),
  hashtags: z
    .array(z.string().regex(/^#[\p{L}\p{N}_]{1,50}$/u, 'must look like #word'))
    .min(1)
    .max(10),
});

export const SocialSchema = z.strictObject({
  youtube: PostSchema,
  tiktok: PostSchema,
  instagram: PostSchema,
  facebook: PostSchema,
});
export type SocialPosts = z.output<typeof SocialSchema>;

export interface SocialFacts {
  recipe: Recipe;
  rules: string[];
  material: Material;
  idea: IdeaDraft;
  script: Script;
}

const SYSTEM = `You are the social media manager of a crew that makes short vertical videos.
Write the post texts for the finished video, one per network, in the line's language:
- youtube (Shorts): a title of at most 100 characters that makes people click, a description, hashtags;
- tiktok, instagram (Reels) and facebook: a title (used as the first line), a caption-style description with the call to action, hashtags.
Use 3 to 8 relevant hashtags per network, written as #word (letters, digits, underscore). Never invent facts or promises.`;

export function buildSocialRequest(facts: SocialFacts, role: RoleConfig): LlmRequest<SocialPosts> {
  return {
    role: 'social',
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
          `## The idea\n${JSON.stringify(facts.idea, null, 2)}`,
          `## The narration\n${facts.script.lines.map((line) => line.text).join('\n')}`,
          'Write the posts.',
        ),
      },
    ],
    schema: SocialSchema,
    maxTokens: 8000,
    facts,
  };
}

export function fakeSocial(facts: SocialFacts): SocialPosts {
  const subject = subjectOf(facts.material);
  const tags = stripAccents(subject)
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 1)
    .slice(0, 3)
    .map((word) => `#${word.toLowerCase()}`);
  const post = {
    title: clip(facts.idea.title, 100),
    description: clip(facts.script.lines.map((line) => line.text).join(' '), 2200),
    hashtags: tags.length ? tags : ['#video'],
  };
  return { youtube: post, tiktok: post, instagram: post, facebook: post };
}
