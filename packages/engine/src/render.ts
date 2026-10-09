import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { ResolvedPlan } from '@dailies-crew/plan';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const require = createRequire(import.meta.url);

/** The Remotion entry point of the scene library */
export const SCENES_ENTRY = require.resolve('@dailies-crew/scenes/entry');

export interface RenderOptions {
  resolved: ResolvedPlan;
  /**
   * Folder with assets/ and voice/, served to the browser that renders the frames. The Remotion
   * bundle is written next to it, in <its parent>/bundle, and removed once the render ends.
   */
  publicDir: string;
  outFile: string;
  onProgress?: (progress: number) => void;
}

/**
 * H.264 MP4 of the DailiesVideo composition. The scenes are bundled into the job folder and the
 * bundle is deleted afterwards, whether the render succeeds or fails (webpack's own cache still
 * speeds up the next bundle).
 */
export async function renderVideo({ resolved, publicDir, outFile, onProgress }: RenderOptions): Promise<void> {
  const outDir = path.join(path.dirname(publicDir), 'bundle');
  try {
    const serveUrl = await bundle({ entryPoint: SCENES_ENTRY, publicDir, outDir, enableCaching: true });
    const inputProps = { plan: resolved };
    const composition = await selectComposition({ serveUrl, id: 'DailiesVideo', inputProps });
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      crf: 18,
      outputLocation: outFile,
      inputProps,
      onProgress: ({ progress }) => onProgress?.(progress),
    });
  } finally {
    await fs.rm(outDir, { recursive: true, force: true });
  }
}
