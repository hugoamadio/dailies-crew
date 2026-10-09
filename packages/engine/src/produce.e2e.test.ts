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

describe('produceVideo end to end', () => {
  it('renders the example plan into a vertical MP4 with the fake voice', async () => {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dailies-e2e-'));
    try {
      const stages: string[] = [];
      const result = await produceVideo({
        planFile: path.join(example, 'plan.json'),
        assetsDir: path.join(example, 'assets'),
        workDir,
        voice: new FakeVoiceProvider(),
        onStage: (stage) => stages.push(stage),
      });

      expect(stages).toEqual(['validate', 'assets', 'voice', 'resolve', 'render', 'done']);
      expect(result.durationSeconds).toBeCloseTo(730 / 30, 5);
      const metadata = await getVideoMetadata(result.outFile);
      expect([metadata.width, metadata.height]).toEqual([1080, 1920]);
      expect(metadata.fps).toBeCloseTo(30, 1);
      expect(metadata.durationInSeconds).toBeCloseTo(result.durationSeconds, 0);
      expect(existsSync(path.join(workDir, 'bundle'))).toBe(false);
    } finally {
      await fs.rm(workDir, { recursive: true, force: true });
    }
  });
});
