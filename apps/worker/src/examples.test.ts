import fs from 'node:fs';
import path from 'node:path';
import { LineInputSchema, ProductInputSchema } from '@dailies-crew/studio';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './env';

const read = (file: string) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, 'examples/studio', file), 'utf8'));

describe('examples/studio', () => {
  it('has a line and a product the studio accepts', () => {
    expect(LineInputSchema.safeParse(read('line.json')).success).toBe(true);
    expect(ProductInputSchema.safeParse(read('product.json')).success).toBe(true);
  });
});
