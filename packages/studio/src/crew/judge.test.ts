import { describe, expect, it } from 'vitest';
import { expectApiSchema } from '../../test/api-schema';
import { briefing, idea, lamp, recipe, roles } from '../../test/crew-fixtures';
import { FakeLlm } from '../llm/fake';
import {
  buildJudgeRequest,
  type CandidateIdea,
  decideCommittee,
  fakeScores,
  type JudgeFacts,
  type JudgeOutput,
  judgeSchema,
} from './judge';

const candidate = (key: string, bankedId: string | null = null): CandidateIdea => ({
  ...idea,
  key,
  style: 'funny',
  bankedId,
});

function verdict(scores: Record<string, number>): JudgeOutput {
  return {
    scores: Object.entries(scores).map(([ideaId, score]) => ({
      ideaId,
      score,
      reason: 'Clear hook',
    })),
  };
}

describe('judgeSchema', () => {
  it('is a schema the API accepts, with the idea ids as an enum', () => {
    expectApiSchema(judgeSchema(['idea-1', 'idea-2']));
  });

  it('wants every idea scored exactly once', () => {
    const schema = judgeSchema(['idea-1', 'idea-2']);
    expect(schema.safeParse(verdict({ 'idea-1': 5, 'idea-2': 7 })).success).toBe(true);
    const missing = schema.safeParse(verdict({ 'idea-1': 5 }));
    expect(missing.error?.issues[0]?.message).toBe(
      'idea idea-2 must be scored exactly once (scored 0 times)',
    );
    expect(schema.safeParse(verdict({ 'idea-1': 5, 'idea-9': 7 })).success).toBe(false);
  });
});

describe('decideCommittee', () => {
  const ideas = [
    candidate('idea-1'),
    candidate('idea-2'),
    candidate('idea-3'),
    candidate('idea-4', 'old'),
  ];

  it('picks the highest sum, banks the good losers and discards the rest', () => {
    const decision = decideCommittee(ideas, {
      objective: verdict({ 'idea-1': 7, 'idea-2': 9, 'idea-3': 3, 'idea-4': 2 }),
      retention: verdict({ 'idea-1': 7, 'idea-2': 9, 'idea-3': 3, 'idea-4': 2 }),
      brand: verdict({ 'idea-1': 7, 'idea-2': 8, 'idea-3': 3, 'idea-4': 2 }),
    });
    expect(decision).toMatchObject({ winner: 'idea-2', banked: ['idea-1'], discarded: ['idea-3'] });
    expect(decision.tallies.find((tally) => tally.key === 'idea-2')?.total).toBe(26);
  });

  it('breaks a tie in favour of the earliest idea, and a banked idea can win', () => {
    const tie = verdict({ 'idea-1': 5, 'idea-2': 5, 'idea-3': 5, 'idea-4': 9 });
    expect(
      decideCommittee(ideas.slice(0, 3), { objective: tie, retention: tie, brand: tie }).winner,
    ).toBe('idea-1');
    expect(decideCommittee(ideas, { objective: tie, retention: tie, brand: tie }).winner).toBe(
      'idea-4',
    );
  });
});

describe('a judge', () => {
  it('scores every idea of the request, and the fake scores fit the schema', async () => {
    const ideas = [candidate('idea-1'), candidate('idea-2')];
    const facts: JudgeFacts = {
      criterion: 'brand',
      recipe,
      rules: [],
      material: lamp,
      briefing,
      ideas,
    };
    const request = buildJudgeRequest(facts, roles.judge);
    expect(request.system).toContain('BRAND');
    const llm = new FakeLlm({ judge: (input) => fakeScores(input as JudgeFacts) });
    const { data } = await llm.generate(request);
    expect(data.scores.map((score) => score.ideaId)).toEqual(['idea-1', 'idea-2']);
  });
});
