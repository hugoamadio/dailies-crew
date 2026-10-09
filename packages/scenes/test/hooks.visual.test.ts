import { describe, it } from 'vitest';
import { DEMO_BRAND } from '../src/demo';
import { expectMarginsEmpty, expectPieceSnapshot } from './visual';

const LONGEST_QUESTION =
  'Você sabia que dá para imprimir em 3D uma luminária inteira em menos de um dia?';

describe('hooks', () => {
  it('question with an underlined emphasis', async () => {
    await expectPieceSnapshot('hook-question', 'hook-question', { frame: 50 });
  });
  it('question words still popping in', async () => {
    await expectPieceSnapshot('hook-question-entering', 'hook-question', { frame: 10 });
  });
  it('the longest question fits inside the content area', async () => {
    const file = await expectPieceSnapshot('hook-question-longest', 'hook-question', {
      frame: 80,
      params: { question: LONGEST_QUESTION, emphasis: 'menos de um dia' },
      background: { kind: 'solid' },
      light: { sweep: false, vignette: 0 },
    });
    await expectMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
  it('burst at its peak', async () => {
    await expectPieceSnapshot('hook-burst-peak', 'hook-burst', { frame: 6 });
  });
  it('burst settled, inside the content area', async () => {
    const file = await expectPieceSnapshot('hook-burst', 'hook-burst', {
      frame: 40,
      background: { kind: 'solid' },
      light: { sweep: false, vignette: 0 },
    });
    await expectMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
  it('the longest question is complete at the end of its shortest scene', async () => {
    const file = await expectPieceSnapshot('hook-question-longest-min', 'hook-question', {
      frame: 44,
      seconds: 1.5,
      params: { question: LONGEST_QUESTION, emphasis: 'menos de um dia' },
      background: { kind: 'solid' },
      light: { sweep: false, vignette: 0 },
    });
    await expectMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
  it('the longest burst has landed at the end of its shortest scene', async () => {
    const file = await expectPieceSnapshot('hook-burst-longest-min', 'hook-burst', {
      frame: 29,
      seconds: 1,
      params: { text: 'PROMOÇÃO RELÂMPAGO HOJE!' },
      background: { kind: 'solid' },
      light: { sweep: false, vignette: 0 },
    });
    await expectMarginsEmpty(file, DEMO_BRAND.colors.background);
  });
});
