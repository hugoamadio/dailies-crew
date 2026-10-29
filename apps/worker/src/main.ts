import { STAGE_HANDLERS, startSweeper, startWorkers, syncSchedules } from '@dailies-crew/studio';
import { loadEnv, workerEnv } from './env';
import { createRuntime } from './runtime';

/**
 * The studio's process: pg-boss workers for every stage and for the daily runs, the line
 * schedules, and a graceful stop (jobs in progress get 60 s; an interrupted one runs again).
 */
async function main(): Promise<void> {
  loadEnv();
  const { concurrency } = workerEnv(process.env);
  const runtime = await createRuntime(process.env, { queue: true, worker: true });
  const boss = runtime.boss!;
  await startWorkers(boss, runtime.ctx, STAGE_HANDLERS, { concurrency });
  const stopSweeper = startSweeper(runtime.ctx, boss);
  const { scheduled } = await syncSchedules(boss, runtime.db);
  const ai = runtime.ctx.llm.name === 'fake' ? 'the fake AI (DAILIES_FAKE_AI=1)' : 'Claude';
  console.log(
    `Dailies Crew worker ready with ${ai}: ${scheduled.length} active lines scheduled, data in ${runtime.ctx.dataDir}`,
  );
  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal}: finishing the jobs in progress (up to 60 s)...`);
    stopSweeper();
    try {
      await runtime.close();
    } catch (error) {
      console.error(
        `Could not stop cleanly: ${error instanceof Error ? error.message : String(error)}`,
      );
      await runtime.db.$disconnect().catch(() => undefined);
      process.exit(1);
    }
    process.exit(0);
  };
  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
