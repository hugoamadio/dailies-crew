import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { NextRequest } from 'next/server';
import { downloadName, parseRange, resolveDataFile } from '../../../lib/files';
import { getPanel } from '../../../lib/panel';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ path: string[] }> };

/** No file served here ever runs as a page (an SVG with a script, say) */
const SAFE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox",
  'x-frame-options': 'DENY',
  'cross-origin-resource-policy': 'same-origin',
  'cache-control': 'no-store',
  'accept-ranges': 'bytes',
};

async function serve(request: NextRequest, context: Context, withBody: boolean) {
  const { ctx } = await getPanel();
  const found = await resolveDataFile(ctx.dataDir, (await context.params).path);
  if (!found) return new Response('Not found\n', { status: 404 });
  const headers: Record<string, string> = { ...SAFE_HEADERS, 'content-type': found.type };
  const download = request.nextUrl.searchParams.get('download');
  if (download !== null) {
    const name = downloadName(download, path.basename(found.file), path.extname(found.file));
    headers['content-disposition'] = `attachment; filename="${name}"`;
  }
  const range = parseRange(request.headers.get('range'), found.size);
  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: { ...headers, 'content-range': `bytes */${found.size}` },
    });
  }
  const { start, end } = range ?? { start: 0, end: found.size - 1 };
  headers['content-length'] = String(Math.max(0, end - start + 1));
  if (range) headers['content-range'] = `bytes ${start}-${end}/${found.size}`;
  const body =
    withBody && found.size > 0
      ? (Readable.toWeb(fs.createReadStream(found.file, { start, end })) as ReadableStream)
      : null;
  return new Response(body, { status: range ? 206 : 200, headers });
}

/** Videos, review frames, product photos and logos from the data folder (DAILIES_DATA_DIR) */
export function GET(request: NextRequest, context: Context) {
  return serve(request, context, true);
}

export function HEAD(request: NextRequest, context: Context) {
  return serve(request, context, false);
}
