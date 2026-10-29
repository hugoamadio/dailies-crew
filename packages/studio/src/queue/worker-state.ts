import type { Db } from '@dailies-crew/db';

/** pg-boss's connections carry this application_name in the worker process ("npm run worker") */
export const WORKER_APPLICATION_NAME = 'dailies-worker';

/**
 * Whether a worker is connected to this database right now. A running worker always holds
 * pg-boss connections (it polls its queues every few seconds) and Postgres drops them when the
 * process dies, so pg_stat_activity answers without any heartbeat table.
 */
export async function workerOnline(db: Db): Promise<boolean> {
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count FROM pg_stat_activity
    WHERE datname = current_database() AND application_name = ${WORKER_APPLICATION_NAME}`;
  return Number(rows[0]?.count ?? 0) > 0;
}
