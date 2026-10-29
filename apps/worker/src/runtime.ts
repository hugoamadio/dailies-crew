import { createDb, type Db } from '@dailies-crew/db';
import { produceVideo } from '@dailies-crew/engine';
import { createVoiceProvider, type VoiceProvider } from '@dailies-crew/engine/voice';
import {
  BossQueue,
  createStudioLlm,
  ensureQueues,
  type JobQueue,
  type LlmClient,
  StudioError,
  type StudioContext,
} from '@dailies-crew/studio';
import { PgBoss } from 'pg-boss';
import { workerEnv } from './env';

export interface Runtime {
  ctx: StudioContext;
  db: Db;
  /** Null when started without the queue */
  boss: PgBoss | null;
  close(): Promise<void>;
}

export interface RuntimeOptions {
  /** Start pg-boss (the worker and the commands that queue jobs or change schedules) */
  queue: boolean;
  /** The worker processes jobs, runs maintenance and the schedules; the CLI only sends */
  worker: boolean;
  /** pg-boss schema; tests use their own */
  bossSchema?: string;
  /** The CLI creates the AI client only when a command needs it (no key needed for "status") */
  lazyLlm?: boolean;
  log?: (message: string) => void;
}

function lazy(create: () => LlmClient): LlmClient {
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

const noQueue: JobQueue = {
  enqueue: async () => {
    throw new Error('This command was started without the queue');
  },
};

/**
 * The voice a line uses. With the fake AI (DAILIES_FAKE_AI=1) every line gets the silent fake
 * voice, so nothing is paid, unless DAILIES_REAL_VOICE=1 asks for the line's real provider.
 */
export function voiceFor(
  provider: 'elevenlabs' | 'fake',
  env: Record<string, string | undefined>,
): VoiceProvider {
  const free = env.DAILIES_FAKE_AI === '1' && env.DAILIES_REAL_VOICE !== '1';
  try {
    return createVoiceProvider(free ? 'fake' : provider, env);
  } catch (error) {
    // a missing ElevenLabs key will not appear by retrying
    throw new StudioError(error instanceof Error ? error.message : String(error));
  }
}

/** Database, AI, voices, queue and data folder, wired from the environment */
export async function createRuntime(
  env: Record<string, string | undefined>,
  options: RuntimeOptions,
): Promise<Runtime> {
  const { databaseUrl, dataDir } = workerEnv(env);
  const log = options.log ?? ((message: string) => console.log(message));
  const llm = options.lazyLlm ? lazy(() => createStudioLlm(env)) : createStudioLlm(env);
  const db = createDb(databaseUrl);
  let boss: PgBoss | null = null;
  try {
    if (options.queue) {
      boss = new PgBoss({
        connectionString: databaseUrl,
        application_name: options.worker ? 'dailies-worker' : 'dailies-cli',
        supervise: options.worker,
        schedule: options.worker,
        ...(options.bossSchema ? { schema: options.bossSchema } : {}),
      });
      boss.on('error', (error) => log(`[queue] ${error.message}`));
      await boss.start();
      await ensureQueues(boss);
    }
  } catch (error) {
    // close what was opened, or the process hangs on the open connections
    await boss?.stop({ graceful: false, timeout: 5_000 }).catch(() => undefined);
    await db.$disconnect().catch(() => undefined);
    throw error;
  }
  const ctx: StudioContext = {
    db,
    llm,
    voices: (provider) => voiceFor(provider, env),
    queue: boss ? new BossQueue(boss) : noQueue,
    dataDir,
    now: () => new Date(),
    log,
    produce: produceVideo,
  };
  return {
    ctx,
    db,
    boss,
    close: async () => {
      await boss?.stop({ graceful: true, timeout: 60_000 });
      await db.$disconnect();
    },
  };
}
