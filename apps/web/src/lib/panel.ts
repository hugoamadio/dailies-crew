import { createDb, type Db } from '@dailies-crew/db';
import {
  BossQueue,
  createStudioLlm,
  ensureQueues,
  type LlmClient,
  StudioError,
  type StudioContext,
  syncSchedules,
} from '@dailies-crew/studio';
import { PgBoss } from 'pg-boss';
import { findRepoRoot, loadRootEnv, panelEnv } from './env';

/** What the pages and actions work with: the studio's context plus the line schedules */
export interface Panel {
  ctx: StudioContext;
  /** The environment (root .env loaded): only "configured or missing" ever leaves the server */
  env: Record<string, string | undefined>;
  /** Makes pg-boss's daily schedules match the lines (after any line or settings change) */
  syncSchedules(): Promise<void>;
  close(): Promise<void>;
}

/** pg-boss connections of the panel show up under this name in pg_stat_activity */
export const PANEL_APPLICATION_NAME = 'dailies-panel';

function lazyLlm(create: () => LlmClient): LlmClient {
  let client: LlmClient | undefined;
  return {
    get name() {
      client ??= create();
      return client.name;
    },
    generate: (request) => {
      client ??= create();
      return client.generate(request);
    },
  };
}

const NOT_HERE = 'The panel never makes voices or videos: the worker does ("npm run worker")';

/**
 * Database, a send-only pg-boss (no workers, no maintenance, no schedule clock: the worker does
 * all that) and the AI client, created on first use (only "reject" calls the rejection router).
 */
export async function createPanel(
  env: Record<string, string | undefined>,
  options: { bossSchema?: string; log?: (message: string) => void } = {},
): Promise<Panel> {
  const root = findRepoRoot(process.cwd());
  loadRootEnv(root);
  const merged = { ...process.env, ...env };
  const { databaseUrl, dataDir } = panelEnv(merged, root);
  const log = options.log ?? ((message: string) => console.log(message));
  const db: Db = createDb(databaseUrl);
  const boss = new PgBoss({
    connectionString: databaseUrl,
    application_name: PANEL_APPLICATION_NAME,
    supervise: false,
    schedule: false,
    max: 4,
    ...(options.bossSchema ? { schema: options.bossSchema } : {}),
  });
  boss.on('error', (error) => log(`[queue] ${error.message}`));
  try {
    await boss.start();
    await ensureQueues(boss);
  } catch (error) {
    await boss.stop({ graceful: false }).catch(() => undefined);
    await db.$disconnect().catch(() => undefined);
    throw error;
  }
  const ctx: StudioContext = {
    db,
    llm: lazyLlm(() => createStudioLlm(merged)),
    voices: () => {
      throw new StudioError(NOT_HERE);
    },
    queue: new BossQueue(boss),
    dataDir,
    now: () => new Date(),
    log,
    produce: async () => {
      throw new StudioError(NOT_HERE);
    },
  };
  return {
    ctx,
    env: merged,
    syncSchedules: async () => {
      await syncSchedules(boss, db);
    },
    close: async () => {
      await boss.stop({ graceful: false });
      await db.$disconnect();
    },
  };
}

const holder = globalThis as typeof globalThis & { __dailiesPanel?: Promise<Panel> };

/**
 * One panel per server process, created on first use. Kept on globalThis so "next dev" reloads
 * reuse it instead of opening new connections; a failed start (database down) is tried again.
 */
export function getPanel(): Promise<Panel> {
  holder.__dailiesPanel ??= createPanel({}).catch((error: unknown) => {
    holder.__dailiesPanel = undefined;
    throw error;
  });
  return holder.__dailiesPanel;
}
