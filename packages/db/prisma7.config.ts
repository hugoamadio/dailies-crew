// Prisma CLI configuration (generate, migrate). Prisma 7.10 looks for "prisma7.config.ts" first
// ("prisma.config.ts" is reserved for Prisma 8). Paths are relative to this file.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(here, '../../.env'));
} catch {
  // no .env file: the environment alone is used
}

export default defineConfig({
  schema: path.join(here, 'prisma/schema.prisma'),
  migrations: { path: path.join(here, 'prisma/migrations') },
  // process.env (not env()) so "prisma generate" works without a database
  datasource: { url: process.env['DATABASE_URL'] },
});
