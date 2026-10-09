import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PlanError } from '@dailies-crew/plan';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EngineError } from './errors';
import { produceVideo } from './produce';
import { FakeVoiceProvider } from './voice';

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dailies-produce-'));
});
afterEach(() => fs.rm(dir, { recursive: true, force: true }));

describe('produceVideo', () => {
  it('stops at an invalid plan before doing any work', async () => {
    const planFile = path.join(dir, 'plan.json');
    await fs.writeFile(planFile, JSON.stringify({ version: 1 }));
    const error = await produceVideo({ planFile, assetsDir: dir, workDir: path.join(dir, 'work'), voice: new FakeVoiceProvider() }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(PlanError);
    await expect(fs.access(path.join(dir, 'work'))).rejects.toThrow();
  });

  it('names a plan file that does not exist', async () => {
    const planFile = path.join(dir, 'missing.json');
    const error = await produceVideo({ planFile, assetsDir: dir, voice: new FakeVoiceProvider() }).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(EngineError);
    expect((error as Error).message).toBe(`plan file not found: ${planFile}`);
  });

  it('explains a plan file that is not JSON', async () => {
    const planFile = path.join(dir, 'plan.json');
    await fs.writeFile(planFile, '{ not json');
    await expect(produceVideo({ planFile, assetsDir: dir, voice: new FakeVoiceProvider() })).rejects.toThrow(EngineError);
    await expect(produceVideo({ planFile, assetsDir: dir, voice: new FakeVoiceProvider() })).rejects.toThrow(
      /is not valid JSON/,
    );
  });
});
