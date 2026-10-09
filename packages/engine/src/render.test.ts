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
}));
vi.mock('@remotion/bundler', () => ({ bundle: remotion.bundle }));
vi.mock('@remotion/renderer', () => ({
  selectComposition: remotion.selectComposition,
  renderMedia: remotion.renderMedia,
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

const options = () => ({
  resolved: {} as ResolvedPlan,
  publicDir: path.join(workDir, 'public'),
  outFile: path.join(workDir, 'video.mp4'),
});

describe('renderVideo', () => {
  it('bundles into <workDir>/bundle and deletes it after the render', async () => {
    remotion.renderMedia.mockResolvedValue(undefined);
    await renderVideo(options());
    expect(remotion.bundle).toHaveBeenCalledWith(
      expect.objectContaining({ outDir: path.join(workDir, 'bundle') }),
    );
    expect(existsSync(path.join(workDir, 'bundle'))).toBe(false);
    expect(existsSync(path.join(workDir, 'public'))).toBe(true);
  });

  it('deletes the bundle when the render fails too', async () => {
    remotion.renderMedia.mockRejectedValue(new Error('the browser crashed'));
    await expect(renderVideo(options())).rejects.toThrow('the browser crashed');
    expect(existsSync(path.join(workDir, 'bundle'))).toBe(false);
  });
});
