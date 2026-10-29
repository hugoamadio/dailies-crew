import 'server-only';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { imageExtension, safeFileName } from '@dailies-crew/studio';

/** The files a person picked in a file field (browsers send an empty file when none was) */
export function filesFrom(form: FormData, name: string): File[] {
  return form
    .getAll(name)
    .filter((value): value is File => value instanceof File && value.size > 0 && value.name !== '');
}

/**
 * Hands uploaded images to a studio service as paths: each file goes to its own folder under
 * <data>/tmp/uploads (keeping its name, which the asset import reuses), and the folder is removed
 * once the service has copied what it needs, whatever happens.
 */
export async function withUploads<T>(
  dataDir: string,
  files: readonly File[],
  work: (paths: string[]) => Promise<T>,
): Promise<T> {
  for (const file of files) imageExtension(file.name);
  const folder = path.join(dataDir, 'tmp', 'uploads', randomUUID());
  try {
    const paths: string[] = [];
    for (const [index, file] of files.entries()) {
      const target = path.join(folder, String(index), safeFileName(file.name));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, Buffer.from(await file.arrayBuffer()));
      paths.push(target);
    }
    return await work(paths);
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
}
