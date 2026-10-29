import type { Db } from '../src';

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

/** Empties every table of the app (not pg-boss's schema). No Vitest here: Playwright uses it too */
export async function resetDb(db: Db): Promise<void> {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`);
}
