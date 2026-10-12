import { inject } from 'vitest';
import { createDb, type Db } from '../src';

/** A client on the test database prepared by global-setup.ts (integration tests only) */
export function testDb(): Db {
  return createDb(inject('testDatabaseUrl'));
}

const TABLES = [
  'decisions',
  'cost_entries',
  'ideas',
  'stage_runs',
  'learned_rules',
  'videos',
  'products',
  'production_lines',
  'settings',
];

/** Empties every table of the app (not pg-boss's schema) */
export async function resetDb(db: Db): Promise<void> {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`);
}
