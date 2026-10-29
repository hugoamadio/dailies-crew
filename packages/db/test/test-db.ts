import { inject } from 'vitest';
import { createDb, type Db } from '../src';

export { resetDb } from './reset';

/** A client on the test database prepared by global-setup.ts (integration tests only) */
export function testDb(): Db {
  return createDb(inject('testDatabaseUrl'));
}
