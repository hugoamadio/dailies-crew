import { PrismaPg } from '@prisma/adapter-pg';
import { type Prisma, PrismaClient } from './generated/prisma/client';

export * from './generated/prisma/client';

export type Db = PrismaClient;
/** The client handed to the callback of db.$transaction(async (tx) => ...) */
export type Tx = Prisma.TransactionClient;

/**
 * A Prisma client on Postgres through the pg driver adapter. The session time zone is pinned to
 * UTC: the adapter sends a Date without its offset and reads a timestamptz ignoring the offset
 * Postgres prints, so any other session time zone would shift every instant.
 */
export function createDb(databaseUrl: string): Db {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl, options: '-c TimeZone=UTC' }),
  });
}
