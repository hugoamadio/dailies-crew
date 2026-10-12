import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ResolvedPlan } from '@dailies-crew/plan';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const remotion = vi.hoisted(() => ({
  bundle: vi.fn(),
  selectComposition: vi.fn(),
  renderMedia: vi.fn(),
  renderFrames: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('@remotion/bundler', () => ({ bundle: remotion.bundle }));
vi.mock('@remotion/renderer', () => ({
  selectComposition: remotion.selectComposition,
  renderMedia: remotion.renderMedia,
  renderFrames: remotion.renderFrames,
  makeCancelSignal: () => ({ cancelSignal: () => undefined, cancel: remotion.cancel }),
}));

const { renderVideo } = await import('./render');

let workDir: string;
beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dailies-render-'));
  await fs.mkdir(path.join(workDir, 'public'));
  remotion.bundle.mockImplementation(async ({ outDir }: { outDir: string }) => {
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, 'bundle.js'), '');
    return outDir;
  });
  remotion.selectComposition.mockResolvedValue({ id: 'DailiesVideo' });
});
afterEach(async () => {
  vi.clearAllMocks();
  await fs.rm(workDir, { recursive: true, force: true });
});

const writeVideo = async ({ outputLocation }: { outputLocation: string }) => {
  await fs.writeFile(outputLocation, 'video');
};

const options = () => ({
  resolved: {} as ResolvedPlan,
  publicDir: path.join(workDir, 'public'),
  outFile: path.join(workDir, 'video.mp4'),
});

describe('renderVideo', () => {
  it('bundles into <workDir>/bundle and deletes it after the render', async () => {
    remotion.renderMedia.mockImplementation(writeVideo);
    const result = await renderVideo(options());
    expect(remotion.bundle).toHaveBeenCalledWith(
      expect.objectContaining({ outDir: path.join(workDir, 'bundle') }),
    );
    expect(existsSync(path.join(workDir, 'bundle'))).toBe(false);
    expect(existsSync(path.join(workDir, 'public'))).toBe(true);
    expect(result).toEqual({ frameFiles: [] });
    expect(await fs.readFile(path.join(workDir, 'video.mp4'), 'utf8')).toBe('video');
    expect(existsSync(path.join(workDir, 'video.partial.mp4'))).toBe(false);
    expect(remotion.renderFrames).not.toHaveBeenCalled();
  });

  it('deletes the bundle when the render fails too', async () => {
    remotion.renderMedia.mockRejectedValue(new Error('the browser crashed'));
    await expect(renderVideo(options())).rejects.toThrow('the browser crashed');
    expect(existsSync(path.join(workDir, 'bundle'))).toBe(false);
  });

  it('leaves no video behind when the render fails or is cancelled, and drops a stale one', async () => {
    await fs.writeFile(path.join(workDir, 'video.mp4'), 'stale');
    await fs.mkdir(path.join(workDir, 'frames'));
    remotion.renderMedia.mockImplementation(async (args: { outputLocation: string }) => {
      await fs.writeFile(args.outputLocation, 'half');
      throw new Error('renderMedia() got cancelled');
    });
    await expect(
      renderVideo({ ...options(), reviewFrames: { everyNthFrame: 15, scale: 1 } }),
    ).rejects.toThrow();
    expect(existsSync(path.join(workDir, 'video.mp4'))).toBe(false);
    expect(existsSync(path.join(workDir, 'video.partial.mp4'))).toBe(false);
    expect(existsSync(path.join(workDir, 'frames'))).toBe(false);
  });

  it('renders the review frames from the same bundle, before deleting it', async () => {
    remotion.renderMedia.mockImplementation(writeVideo);
    remotion.renderFrames.mockImplementation(async ({ outputDir }: { outputDir: string }) => {
      expect(existsSync(path.join(workDir, 'bundle', 'bundle.js'))).toBe(true);
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(path.join(outputDir, 'element-1.jpeg'), 'b');
      await fs.writeFile(path.join(outputDir, 'element-0.jpeg'), 'a');
    });
    // frames of an earlier round are replaced
    await fs.mkdir(path.join(workDir, 'frames'));
    await fs.writeFile(path.join(workDir, 'frames', 'element-9.jpeg'), 'old');

    const result = await renderVideo({
      ...options(),
      reviewFrames: { everyNthFrame: 15, scale: 1 / 3 },
    });

    expect(remotion.renderFrames).toHaveBeenCalledWith(
      expect.objectContaining({
        serveUrl: path.join(workDir, 'bundle'),
        outputDir: path.join(workDir, 'frames'),
        imageFormat: 'jpeg',
        everyNthFrame: 15,
        scale: 1 / 3,
      }),
    );
    expect(result.frameFiles).toEqual([
      path.join(workDir, 'frames', 'element-0.jpeg'),
      path.join(workDir, 'frames', 'element-1.jpeg'),
    ]);
  });

  it('cancels the render when the signal aborts, and refuses to start an aborted one', async () => {
    const controller = new AbortController();
    remotion.renderMedia.mockImplementation(async () => {
      controller.abort();
      throw new Error('renderMedia() got cancelled');
    });
    await expect(renderVideo({ ...options(), signal: controller.signal })).rejects.toThrow(
      'got cancelled',
    );
    expect(remotion.cancel).toHaveBeenCalledTimes(1);

    remotion.bundle.mockClear();
    await expect(renderVideo({ ...options(), signal: controller.signal })).rejects.toThrow();
    expect(remotion.bundle).not.toHaveBeenCalled();
  });
});
