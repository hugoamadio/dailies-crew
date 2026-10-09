import { Slug } from '@dailies-crew/plan';
import { describe, expect, it } from 'vitest';
import { pieceSpecs } from './specs';

describe('pieceSpecs', () => {
  it.each(pieceSpecs.map((spec) => [spec.id, spec] as const))(
    '%s has a valid id, limits, description and example',
    (_, spec) => {
      expect(Slug.safeParse(spec.id).success).toBe(true);
      expect(spec.minSeconds).toBeLessThan(spec.maxSeconds);
      expect(spec.description.length).toBeGreaterThan(60);
      expect(spec.paramsSchema.safeParse(spec.example).success).toBe(true);
    },
  );
});
