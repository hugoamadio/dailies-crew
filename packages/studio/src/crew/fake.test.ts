import { describe, expect, it } from 'vitest';
import { briefing, idea, lamp, recipe, roles } from '../../test/crew-fixtures';
import { directFacts, script } from '../../test/direction-fixtures';
import type { LlmRequest } from '../llm/types';
import { buildCreateRequest } from './creator';
import { buildDirectRequest } from './director';
import { createFakeLlm } from './fake';
import { buildJudgeRequest } from './judge';
import { buildPrepareRequest } from './preparer';
import { buildReviewRequest } from './reviewer';
import { buildRouteRequest } from './router';
import { buildScriptRequest } from './scriptwriter';
import { buildSocialRequest } from './social';

const ideas = [1, 2].map((n) => ({
  ...idea,
  key: `idea-${n}`,
  style: 'funny' as const,
  bankedId: null,
}));

const requests: LlmRequest<unknown>[] = [
  buildPrepareRequest(
    { recipe, rules: [], material: lamp, recentIdeas: [], rejections: [] },
    roles.preparer,
  ),
  buildCreateRequest(
    { style: 'funny', recipe, rules: [], material: lamp, briefing, usedIdeas: [] },
    roles.creator,
  ),
  buildJudgeRequest(
    { criterion: 'objective', recipe, rules: [], material: lamp, briefing, ideas },
    roles.judge,
  ),
  buildScriptRequest(
    { recipe, rules: [], material: lamp, briefing, idea, instructions: [], previousScript: null },
    roles.scriptwriter,
  ),
  buildDirectRequest(directFacts(), roles.director),
  buildReviewRequest(
    {
      focus: 'fidelity',
      recipe,
      rules: [],
      material: lamp,
      idea,
      script,
      directorNotes: '',
      totalSeconds: 20,
      scenes: [],
      voice: [],
      frameSeconds: [0],
    },
    ['AAAA'],
    roles.reviewer,
  ),
  buildSocialRequest({ recipe, rules: [], material: lamp, idea, script }, roles.social),
  buildRouteRequest(
    { recipe, reason: 'O preço está errado', ideaTitle: null, scriptLines: [] },
    roles['rejection-router'],
  ),
];

describe('createFakeLlm', () => {
  it.each(requests.map((request) => [request.role, request] as const))(
    'answers the %s within its schema, for free',
    async (_, request) => {
      const result = await createFakeLlm().generate(request);
      expect(request.schema.safeParse(result.data).success).toBe(true);
      expect(result.usage.inputTokens + result.usage.outputTokens).toBe(0);
    },
  );
});
