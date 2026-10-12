import path from 'node:path';

/**
 * Everything lives under the data folder (DAILIES_DATA_DIR):
 * - assets/products/<productId>/<file>, assets/lines/<lineId>/logo.<ext>, assets/music/<file>:
 *   the files plans point to, by paths relative to assets/;
 * - jobs/<videoId>/: the engine's work folder of each video (voice, render, review frames).
 */
export function assetsDir(dataDir: string): string {
  return path.join(dataDir, 'assets');
}

export function jobDir(dataDir: string, videoId: string): string {
  return path.join(dataDir, 'jobs', videoId);
}

/** A path inside the data folder as stored in the database: relative, with forward slashes */
export function relativeToData(dataDir: string, file: string): string {
  return path.relative(dataDir, file).split(path.sep).join('/');
}
