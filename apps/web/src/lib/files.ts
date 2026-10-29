import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isSafeRelativePath } from '@dailies-crew/plan';

/** What the panel serves from the data folder, by extension: nothing else ever leaves it */
export const CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
};

export interface DataFile {
  file: string;
  size: number;
  type: string;
}

/**
 * The file a /files/<path> URL names inside the data folder, or null. The path must be relative,
 * made of plain segments (letters, digits, ".", "_", "-"; never "." or ".."), end in an allowed
 * extension, and still be inside the data folder once symbolic links are followed.
 */
export async function resolveDataFile(
  dataDir: string,
  segments: readonly string[],
): Promise<DataFile | null> {
  // an encoded "/" (%2F) arrives inside one segment: refused like any other odd character
  if (segments.some((segment) => segment.includes('/'))) return null;
  const relative = segments.join('/');
  if (!isSafeRelativePath(relative)) return null;
  const type = CONTENT_TYPES[path.extname(relative).slice(1).toLowerCase()];
  if (!type) return null;
  try {
    const root = await fs.realpath(dataDir);
    const file = await fs.realpath(path.join(root, relative));
    if (!file.startsWith(root + path.sep)) return null;
    const stat = await fs.stat(file);
    if (!stat.isFile()) return null;
    return { file, size: stat.size, type };
  } catch {
    return null;
  }
}

export type ByteRange = { start: number; end: number };

/**
 * One "bytes=" range of a file of `size` bytes (inclusive ends), "unsatisfiable" (answer 416), or
 * null to send the whole file (no header, another unit, several ranges or a malformed one).
 */
export function parseRange(
  header: string | null,
  size: number,
): ByteRange | 'unsatisfiable' | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, first, last] = match;
  if (first === '' && last === '') return null;
  if (first === '') {
    const suffix = Number(last);
    if (suffix === 0 || size === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(first);
  const end = last === '' ? size - 1 : Math.min(Number(last), size - 1);
  if (last !== '' && Number(last) < start) return null;
  if (start >= size) return 'unsatisfiable';
  return { start, end };
}

function cleanName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '');
}

/**
 * A name for Content-Disposition: the same safe characters as asset names, or the fallback
 * (cleaned too). The extension is always the real file's (`extension`, with its dot), whatever the
 * requested name says, so "?download=x.html" on an SVG cannot save a page.
 */
export function downloadName(wanted: string | null, fallback: string, extension: string): string {
  const strip = (name: string) => {
    const real = name.toLowerCase().endsWith(extension.toLowerCase());
    return real ? name.slice(0, -extension.length) : name.replace(/\.[A-Za-z0-9]+$/, '');
  };
  const stem = strip(cleanName(wanted ?? '')).slice(0, 120);
  return `${stem || strip(cleanName(fallback)) || 'file'}${extension}`;
}
