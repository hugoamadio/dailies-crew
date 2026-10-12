import { describe, expect, it } from 'vitest';
import { productLineInput, topicLineInput } from '../../test/fixtures';
import { LineInputSchema } from './schema';

describe('LineInputSchema', () => {
  it('accepts a product line and fills the defaults', () => {
    const line = LineInputSchema.parse(productLineInput());
    expect(line).toMatchObject({ kind: 'product', musicTrack: null, active: true });
  });

  it('checks the material against the kind', () => {
    expect(
      LineInputSchema.safeParse(productLineInput({ material: { subject: 'x' } })).success,
    ).toBe(false);
    expect(LineInputSchema.parse(topicLineInput()).material).toEqual({
      subject: 'Tips to get better 3D prints at home',
      avoid: 'brand names',
    });
  });

  it('refuses unknown fields, a bad language and a music path outside the assets', () => {
    expect(LineInputSchema.safeParse(productLineInput({ colour: 'red' })).success).toBe(false);
    expect(LineInputSchema.safeParse(productLineInput({ language: 'portuguese' })).success).toBe(
      false,
    );
    expect(LineInputSchema.safeParse(productLineInput({ musicTrack: '../x.mp3' })).success).toBe(
      false,
    );
  });
});
