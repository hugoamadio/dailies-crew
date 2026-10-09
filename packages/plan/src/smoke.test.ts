import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('workspace', () => {
  it('runs tests with zod 4 available', () => {
    expect(z.string().safeParse('ok').success).toBe(true);
  });
});
