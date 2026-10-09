import fs from 'node:fs/promises';
import path from 'node:path';
import { isSafeRelativePath } from '@dailies-crew/plan';
import { EngineError } from './errors';

/**
 * Copies the plan's assets to <publicDir>/assets/<path>, the folder Remotion serves while rendering.
 * Plans come from agents: a path must stay inside the assets folder even through symlinks.
 */
export async function stageAssets(
  paths: readonly string[],
  assetsDir: string,
  publicDir: string,
): Promise<void> {
  const root = await fs.realpath(assetsDir);
  for (const relativePath of paths) {
    if (!isSafeRelativePath(relativePath)) {
      throw new EngineError(`asset "${relativePath}" is not a safe relative path`);
    }
    let real: string;
    try {
      real = await fs.realpath(path.join(root, relativePath));
    } catch {
      throw new EngineError(`asset "${relativePath}" was not found in the assets folder`);
    }
    if (!real.startsWith(root + path.sep)) {
      throw new EngineError(`asset "${relativePath}" points outside the assets folder`);
    }
    const target = path.join(publicDir, 'assets', relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(real, target);
  }
}
