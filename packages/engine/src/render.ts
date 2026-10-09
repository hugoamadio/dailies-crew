import { createRequire } from 'node:module';
import type { ResolvedPlan } from '@dailies-crew/plan';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const require = createRequire(import.meta.url);

/** The Remotion entry point of the scene library */
export const SCENES_ENTRY = require.resolve('@dailies-crew/scenes/entry');

export interface RenderOptions {
  resolved: ResolvedPlan;
  /** Folder with assets/ and voice/, served to the browser that renders the frames */
  publicDir: string;
  outFile: string;
  onProgress?: (progress: number) => void;
}

/** H.264 MP4 of the DailiesVideo composition. The bundle is cached by Remotion between runs */
export async function renderVideo({ resolved, publicDir, outFile, onProgress }: RenderOptions): Promise<void> {
  const serveUrl = await bundle({ entryPoint: SCENES_ENTRY, publicDir, enableCaching: true });
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
}
