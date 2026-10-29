import fs from 'node:fs/promises';
import path from 'node:path';
import { createDb } from '@dailies-crew/db';
import { resetDb } from '@dailies-crew/db/test/reset';
import { prepareTestDatabase } from '../../../packages/db/test/global-setup';
import { E2E_DATA_DIR } from './env';
import { seed } from './seed';

/**
 * (e2e/prepare-db.ts already created and migrated dailies_test before the panel started; the call
 * here is a cheap no-op.) dailies_test emptied, a fresh data folder, the seed; ids for the tests. pg-boss's
 * schema stays: Playwright starts the panel before this runs, and the panel already holds it (no
 * worker reads the jobs the tests send).
 */
export default async function globalSetup(): Promise<void> {
  const url = await prepareTestDatabase();
  const db = createDb(url);
  try {
    await resetDb(db);
    await fs.rm(E2E_DATA_DIR, { recursive: true, force: true });
    await fs.mkdir(E2E_DATA_DIR, { recursive: true });
    const ids = await seed(db, E2E_DATA_DIR);
    await fs.writeFile(path.join(E2E_DATA_DIR, 'seed.json'), JSON.stringify(ids));
  } finally {
    await db.$disconnect();
  }
}
