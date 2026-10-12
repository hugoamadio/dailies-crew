import { describe, expect, it } from 'vitest';
import { lamp, recipe } from '../../test/crew-fixtures';
import { clip, formatPrice, materialSection, recipeSection, rulesSection } from './context';

describe('the prompt sections', () => {
  it('write prices the way the line language does', () => {
    expect(formatPrice(8990, 'BRL', 'pt-BR')).toBe('R$ 89,90');
    expect(formatPrice(8990, 'USD', 'en-US')).toBe('$89.90');
  });

  it('describe the line, its rules and the product', () => {
    expect(recipeSection(recipe)).toContain(
      'Language of everything the viewer reads or hears: pt-BR',
    );
    expect(rulesSection([])).toBe('## Learned rules\n(none yet)');
    expect(rulesSection(['Never show the price first'])).toContain('- Never show the price first');
    expect(materialSection(lamp, 'pt-BR')).toContain('- Price: R$ 89,90 (was R$ 129,90)');
  });

  it('cut long texts at a word', () => {
    expect(clip('A moon lamp printed in 3D', 14)).toBe('A moon lamp');
    expect(clip('short', 14)).toBe('short');
  });
});
