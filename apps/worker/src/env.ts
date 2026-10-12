import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StudioError } from '@dailies-crew/studio';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** The worker and the CLI read the .env of the repository root (variables already set win) */
export function loadEnv(): void {
  try {
    process.loadEnvFile(path.join(repoRoot, '.env'));
  } catch {
    // no .env file: the environment alone is used
  }
}

export interface WorkerEnv {
  databaseUrl: string;
  /** DAILIES_DATA_DIR, default <repo>/data */
  dataDir: string;
  /** DAILIES_CONCURRENCY: videos per crew stage at once, 1-16, default 4 (renders: always 1) */
  concurrency: number;
}

export function workerEnv(env: Record<string, string | undefined>): WorkerEnv {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new StudioError(
      'DATABASE_URL is not set: copy .env.example to .env, then run "npm run db:up"',
    );
  }
  const concurrency = Number(env.DAILIES_CONCURRENCY || 4);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new StudioError('DAILIES_CONCURRENCY must be a whole number from 1 to 16');
  }
  return {
    databaseUrl,
    dataDir: path.resolve(env.DAILIES_DATA_DIR || path.join(repoRoot, 'data')),
    concurrency,
  };
}
