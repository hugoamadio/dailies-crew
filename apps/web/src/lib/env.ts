import fs from 'node:fs';
import path from 'node:path';
import { StudioError } from '@dailies-crew/studio';

/**
 * The repository root: the first folder, from `start` up, whose package.json has workspaces.
 * "npm run web" starts at the root; "next dev" inside apps/web finds it two levels up.
 */
export function findRepoRoot(start: string): string {
  let dir = path.resolve(start);
  for (;;) {
    const file = path.join(dir, 'package.json');
    if (fs.existsSync(file)) {
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as { workspaces?: unknown };
      if (manifest.workspaces) return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir)
      throw new Error(`No repository root (package.json with workspaces) above ${start}`);
    dir = parent;
  }
}

/** The root .env, like the worker reads it (variables already set win; a missing file is fine) */
export function loadRootEnv(root: string): void {
  try {
    process.loadEnvFile(path.join(root, '.env'));
  } catch {
    // no .env file: the environment alone is used
  }
}

export interface PanelEnv {
  databaseUrl: string;
  /** DAILIES_DATA_DIR (relative to the repository root), default <root>/data, as the worker */
  dataDir: string;
}

export function panelEnv(env: Record<string, string | undefined>, root: string): PanelEnv {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new StudioError(
      'DATABASE_URL is not set: copy .env.example to .env, then run "npm run db:up"',
    );
  }
  return {
    databaseUrl,
    dataDir: path.resolve(root, env.DAILIES_DATA_DIR || 'data'),
  };
}
