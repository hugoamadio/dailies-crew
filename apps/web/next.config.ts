import path from 'node:path';
import type { NextConfig } from 'next';

// The monorepo root: Turbopack resolves the hoisted node_modules and the workspace packages there
const root = path.resolve(import.meta.dirname, '../..');

/** Product photos and logos come in through server actions (spec: one user, on this machine) */
const UPLOAD_LIMIT = '25mb';

const config: NextConfig = {
  // the Playwright tests build into .next-e2e, so a running "npm run web" keeps its .next
  distDir: process.env.DAILIES_WEB_DIST_DIR || '.next',
  turbopack: { root },
  outputFileTracingRoot: root,
  poweredByHeader: false,
  // "next dev" would otherwise write an AGENTS.md into apps/web
  agentRules: false,
  // no floating Next badge over the panel (it lands on screenshots)
  devIndicators: false,
  experimental: {
    serverActions: { bodySizeLimit: UPLOAD_LIMIT },
    // the proxy (src/proxy.ts) sees every request body first; its default cap is 10 MB
    proxyClientMaxBodySize: UPLOAD_LIMIT,
  },
};

export default config;
