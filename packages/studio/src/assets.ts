import fs from 'node:fs/promises';
import path from 'node:path';
import { IMAGE_EXTENSIONS, isSafeRelativePath } from '@dailies-crew/plan';
import { StudioError } from './errors';
import { assetsDir } from './paths';

/** Fails unless the path (relative to data/assets) names an existing file */
export async function ensureAsset(
  dataDir: string,
  relativePath: string,
  what: string,
): Promise<void> {
  if (!isSafeRelativePath(relativePath)) {
    throw new StudioError(`${what} "${relativePath}" is not a safe path inside data/assets`);
  }
  const stat = await fs.stat(path.join(assetsDir(dataDir), relativePath)).catch(() => null);
  if (!stat?.isFile()) {
    throw new StudioError(`${what} "${relativePath}" was not found in ${assetsDir(dataDir)}`);
  }
}

/** The extension of an image file the scenes can show, lowercased, or a StudioError */
export function imageExtension(file: string): string {
  const extension = path.extname(file).slice(1).toLowerCase();
  if (!(IMAGE_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new StudioError(
      `"${path.basename(file)}" is not an image the videos can show (${IMAGE_EXTENSIONS.join(', ')})`,
    );
  }
  return extension;
}

/** Copies a file from anywhere into data/assets/<relativePath>; returns relativePath */
export async function importAsset(
  dataDir: string,
  sourceFile: string,
  relativePath: string,
): Promise<string> {
  const stat = await fs.stat(sourceFile).catch(() => null);
  if (!stat?.isFile()) throw new StudioError(`File not found: ${sourceFile}`);
  const target = path.join(assetsDir(dataDir), relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(sourceFile, target);
  return relativePath;
}

/** Drops the accents of a text ("Luminária" becomes "Luminaria") */
export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** A file name the asset paths accept: letters, digits, ".", "_" and "-" only */
export function safeFileName(file: string): string {
  const name = stripAccents(path.basename(file))
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[.-]+/, '');
  return name || 'file';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids come from the CLI and the panel: a malformed one is a "not found", not a database error */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
