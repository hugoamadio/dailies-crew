import path from 'node:path';
import { fileURLToPath } from 'node:url';

export { testDatabaseUrl } from '../../../packages/db/test/global-setup';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** The panel under test: its own port (3300 is the dev panel) and its own build folder */
export const E2E_PORT = 3310;
export const E2E_DIST_DIR = '.next-e2e';
/** The seeded data folder (out/ is git-ignored); the global setup rebuilds it every run */
export const E2E_DATA_DIR = path.join(repoRoot, 'out', 'web-e2e');

/** Sample images the seed and the tests upload */
export const LAMP_SVG = path.join(repoRoot, 'examples/feiraria-lamp/assets/products/lamp.svg');
export const LOGO_SVG = path.join(repoRoot, 'examples/feiraria-lamp/assets/brand/logo.svg');
