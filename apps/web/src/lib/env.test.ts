import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findRepoRoot, panelEnv } from './env';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dailies-web-env-'));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('findRepoRoot', () => {
  it('walks up to the package.json that has workspaces', async () => {
    await fs.writeFile(path.join(dir, 'package.json'), '{"workspaces":["apps/*"]}');
    await fs.mkdir(path.join(dir, 'apps/web/src'), { recursive: true });
    await fs.writeFile(path.join(dir, 'apps/web/package.json'), '{"name":"web"}');
    expect(findRepoRoot(path.join(dir, 'apps/web/src'))).toBe(dir);
    expect(findRepoRoot(dir)).toBe(dir);
  });
});

describe('panelEnv', () => {
  it('needs DATABASE_URL and puts the data folder where the worker puts it', () => {
    expect(() => panelEnv({}, '/repo')).toThrow('DATABASE_URL is not set');
    expect(panelEnv({ DATABASE_URL: 'postgresql://x' }, '/repo')).toEqual({
      databaseUrl: 'postgresql://x',
      dataDir: '/repo/data',
    });
    expect(panelEnv({ DATABASE_URL: 'x', DAILIES_DATA_DIR: 'out/data' }, '/repo').dataDir).toBe(
      '/repo/out/data',
    );
    expect(panelEnv({ DATABASE_URL: 'x', DAILIES_DATA_DIR: '/srv/data' }, '/repo').dataDir).toBe(
      '/srv/data',
    );
  });
});
