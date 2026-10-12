import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { ResolvedPlan } from '@dailies-crew/plan';
import { bundle } from '@remotion/bundler';
import { makeCancelSignal, renderFrames, renderMedia, selectComposition } from '@remotion/renderer';

const require = createRequire(import.meta.url);

/** The Remotion entry point of the scene library */
export const SCENES_ENTRY = require.resolve('@dailies-crew/scenes/entry');

export interface ReviewFramesOptions {
  /** 15 = two frames per second at 30 fps */
  everyNthFrame: number;
  /** 1/3 = 360×640 */
  scale: number;
}

export interface RenderOptions {
  resolved: ResolvedPlan;
  /**
   * Folder with assets/ and voice/, served to the browser that renders the frames. The Remotion
   * bundle is written next to it, in <its parent>/bundle, and removed once the render ends.
   */
  publicDir: string;
  outFile: string;
  onProgress?: (progress: number) => void;
  /** Also renders still JPEG frames for the reviewers into <publicDir's parent>/frames */
  reviewFrames?: ReviewFramesOptions;
  /** Aborting it cancels the render */
  signal?: AbortSignal;
}

export interface RenderResult {
  /** The review frames in time order; empty without reviewFrames */
  frameFiles: string[];
}

/**
 * H.264 MP4 of the DailiesVideo composition, and optionally the review frames from the same
 * bundle. The scenes are bundled into the job folder and the bundle is deleted afterwards,
 * whether the render succeeds or fails (webpack's own cache still speeds up the next bundle).
 */
export async function renderVideo({
  resolved,
  publicDir,
  outFile,
  onProgress,
  reviewFrames,
  signal,
}: RenderOptions): Promise<RenderResult> {
  const jobDir = path.dirname(publicDir);
  const outDir = path.join(jobDir, 'bundle');
  const { cancelSignal, cancel } = makeCancelSignal();
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    signal?.throwIfAborted();
    const serveUrl = await bundle({
      entryPoint: SCENES_ENTRY,
      publicDir,
      outDir,
      enableCaching: true,
    });
    const inputProps = { plan: resolved };
    const composition = await selectComposition({ serveUrl, id: 'DailiesVideo', inputProps });
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      crf: 18,
      outputLocation: outFile,
      inputProps,
      cancelSignal,
      onProgress: ({ progress }) => onProgress?.(progress),
    });
    if (!reviewFrames) return { frameFiles: [] };
    const framesDir = path.join(jobDir, 'frames');
    await fs.rm(framesDir, { recursive: true, force: true });
    await renderFrames({
      composition,
      serveUrl,
      inputProps,
      outputDir: framesDir,
      imageFormat: 'jpeg',
      everyNthFrame: reviewFrames.everyNthFrame,
      scale: reviewFrames.scale,
      cancelSignal,
      onStart: () => undefined,
      onFrameUpdate: () => undefined,
    });
    const names = (await fs.readdir(framesDir)).filter((name) => name.endsWith('.jpeg')).sort();
    return { frameFiles: names.map((name) => path.join(framesDir, name)) };
  } finally {
    signal?.removeEventListener('abort', cancel);
    await fs.rm(outDir, { recursive: true, force: true });
  }
}
