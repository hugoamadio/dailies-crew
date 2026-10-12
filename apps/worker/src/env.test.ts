import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, workerEnv } from './env';

describe('workerEnv', () => {
  it('needs DATABASE_URL', () => {
    expect(() => workerEnv({})).toThrow('DATABASE_URL is not set');
  });

  it('keeps the data in <repo>/data unless DAILIES_DATA_DIR says otherwise', () => {
    expect(workerEnv({ DATABASE_URL: 'postgresql://x' }).dataDir).toBe(path.join(repoRoot, 'data'));
    expect(
      workerEnv({ DATABASE_URL: 'postgresql://x', DAILIES_DATA_DIR: '/srv/dailies' }).dataDir,
    ).toBe('/srv/dailies');
  });
});
