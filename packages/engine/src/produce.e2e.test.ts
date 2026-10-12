import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVideoMetadata } from '@remotion/renderer';
import { describe, expect, it } from 'vitest';
import { produceVideo } from './produce';
import { FakeVoiceProvider } from './voice';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const example = path.join(repoRoot, 'examples/feiraria-lamp');

/** Width and height from the start-of-frame marker of a JPEG file */
function jpegSize(data: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset < data.length) {
    const marker = data.readUInt16BE(offset);
    if (marker >= 0xffc0 && marker <= 0xffc2) {
      return { height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) };
    }
    offset += 2 + data.readUInt16BE(offset + 2);
  }
  throw new Error('no start-of-frame marker');
}

describe('produceVideo end to end', () => {
  it('renders the example plan into a vertical MP4 with the fake voice, and its review frames', async () => {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dailies-e2e-'));
    try {
      const stages: string[] = [];
      const result = await produceVideo({
        planFile: path.join(example, 'plan.json'),
        assetsDir: path.join(example, 'assets'),
        workDir,
        voice: new FakeVoiceProvider(),
        reviewFrames: { everyNthFrame: 15, scale: 1 / 3 },
        onStage: (stage) => stages.push(stage),
      });

      expect(stages).toEqual(['validate', 'assets', 'voice', 'resolve', 'render', 'done']);
      expect(result.durationSeconds).toBeCloseTo(730 / 30, 5);
      const metadata = await getVideoMetadata(result.outFile);
      expect([metadata.width, metadata.height]).toEqual([1080, 1920]);
      expect(metadata.fps).toBeCloseTo(30, 1);
      expect(metadata.durationInSeconds).toBeCloseTo(result.durationSeconds, 0);
      expect(existsSync(path.join(workDir, 'bundle'))).toBe(false);

      // frames 0, 15, ..., 720: two per second
      expect(result.frameFiles).toHaveLength(49);
      expect(jpegSize(await fs.readFile(result.frameFiles[0]!))).toEqual({
        width: 360,
        height: 640,
      });

      // a second run of the same job reuses the voice already paid for
      const again = await produceVideo({
        planFile: path.join(example, 'plan.json'),
        assetsDir: path.join(example, 'assets'),
        workDir,
        voice: new FakeVoiceProvider(),
      });
      expect(again.voiceCharacters).toBe(0);
      expect(again.cachedVoiceCharacters).toBe(result.voiceCharacters);
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  });
});
