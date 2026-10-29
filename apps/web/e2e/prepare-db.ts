import { prepareTestDatabase } from '../../../packages/db/test/global-setup';

// Runs before "next build" in the webServer command: Playwright starts the panel before the
// global setup, and the panel must find dailies_test created and migrated (even on a fresh machine)
await prepareTestDatabase();
