import { describe, expect, it } from 'vitest';
import { LineInputSchema } from './lines/schema';
import { parseInput, StudioError } from './errors';

describe('parseInput', () => {
  it('throws a StudioError that keeps the path of every problem for the panel', () => {
    let caught: unknown;
    try {
      parseInput(LineInputSchema, { kind: 'topic', name: '', material: {} }, 'line');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(StudioError);
    const { issues, message } = caught as StudioError;
    expect(message).toMatch(/^Invalid line:\n- /);
    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(['name', 'material.subject', 'brand']),
    );
  });

  it('gives errors made by hand no issues', () => {
    expect(new StudioError('No video with id x').issues).toEqual([]);
  });
});
