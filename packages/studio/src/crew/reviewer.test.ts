import { describe, expect, it } from 'vitest';
import { expectApiSchema } from '../../test/api-schema';
import { idea, lamp, recipe, roles } from '../../test/crew-fixtures';
import { script } from '../../test/direction-fixtures';
import {
  buildReviewRequest,
  decideReview,
  REVIEW_FOCUSES,
  type Review,
  type ReviewFacts,
  ReviewSchema,
  sampleEvenly,
} from './reviewer';

const facts: ReviewFacts = {
  focus: 'art',
  recipe,
  rules: [],
  material: lamp,
  idea,
  script,
  directorNotes: 'Warm and dreamy',
  totalSeconds: 20,
  scenes: [],
  voice: [],
  frameSeconds: [0, 0.5],
};

const approve: Review = { verdict: 'approve', notes: 'fine', adjustments: [] };

describe('the reviewers', () => {
  it('answer in a schema the API accepts', () => {
    expectApiSchema(ReviewSchema);
  });

  it('share the system prompt and the frames, cached after the last frame; only the focus differs', () => {
    const requests = REVIEW_FOCUSES.map((focus) =>
      buildReviewRequest({ ...facts, focus }, ['AAAA', 'BBBB'], roles.reviewer),
    );
    expect(new Set(requests.map((request) => request.system)).size).toBe(1);
    const [art] = requests;
    expect(art!.content.map((block) => block.type)).toEqual(['text', 'image', 'image', 'text']);
    expect(art!.content[1]).not.toHaveProperty('cacheBreakpoint');
    expect(art!.content[2]).toMatchObject({
      type: 'image',
      mediaType: 'image/jpeg',
      cacheBreakpoint: true,
    });
    expect((art!.content[3] as { text: string }).text).toContain('Your focus: ART');
    expect(requests.map((request) => request.content[0])).toEqual(Array(3).fill(art!.content[0]));
  });
});

describe('decideReview', () => {
  it('approves when every reviewer approves', () => {
    expect(decideReview({ art: approve, rhythm: approve, fidelity: approve }, 0)).toEqual({
      kind: 'approve',
    });
  });

  it('goes back to the earliest stage asked for, with every instruction', () => {
    const decision = decideReview(
      {
        art: {
          verdict: 'adjust',
          notes: 'x',
          adjustments: [{ stage: 'direction', instruction: 'Bigger price text' }],
        },
        rhythm: approve,
        fidelity: {
          verdict: 'adjust',
          notes: 'x',
          adjustments: [{ stage: 'script', instruction: 'Say the right price' }],
        },
      },
      0,
    );
    expect(decision).toEqual({
      kind: 'adjust',
      from: 'script',
      instructions: [
        { stage: 'direction', instruction: '(art) Bigger price text', source: 'review' },
        { stage: 'script', instruction: '(fidelity) Say the right price', source: 'review' },
      ],
    });
  });

  it('treats an "adjust" without adjustments as a note for the director', () => {
    const decision = decideReview(
      {
        art: { verdict: 'adjust', notes: 'Too dark', adjustments: [] },
        rhythm: approve,
        fidelity: approve,
      },
      1,
    );
    expect(decision).toMatchObject({ kind: 'adjust', from: 'direction' });
  });

  it('hands the video to Hugo after two review rounds', () => {
    const decision = decideReview(
      {
        art: approve,
        rhythm: {
          verdict: 'adjust',
          notes: 'x',
          adjustments: [{ stage: 'produce', instruction: 'The voice is robotic' }],
        },
        fidelity: approve,
      },
      2,
    );
    expect(decision).toEqual({
      kind: 'needs_you',
      problems: ['produce: (rhythm) The voice is robotic'],
    });
  });
});

describe('sampleEvenly', () => {
  it('keeps everything under the limit and the first and last items over it', () => {
    expect(sampleEvenly([1, 2, 3], 5)).toEqual([1, 2, 3]);
    const picked = sampleEvenly(
      Array.from({ length: 120 }, (_, index) => index),
      100,
    );
    expect(picked).toHaveLength(100);
    expect([picked[0], picked.at(-1)]).toEqual([0, 119]);
  });
});
