import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stageAssets } from './stage';

let root: string;
const assets = () => path.join(root, 'assets');
const publicDir = () => path.join(root, 'public');

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'dailies-stage-'));
  await fs.mkdir(path.join(root, 'assets/products'), { recursive: true });
  await fs.writeFile(path.join(root, 'assets/products/lamp.svg'), '<svg/>');
  await fs.writeFile(path.join(root, 'outside.svg'), '<svg/>');
  // A symlink inside the assets folder that points outside of it
  await fs.symlink(path.join(root, 'outside.svg'), path.join(root, 'assets/evil.svg'));
});

afterEach(() => fs.rm(root, { recursive: true, force: true }));

describe('stageAssets', () => {
  it('copies each asset under public/assets, keeping its path', async () => {
    await stageAssets(['products/lamp.svg'], assets(), publicDir());
    expect(await fs.readFile(path.join(publicDir(), 'assets/products/lamp.svg'), 'utf8')).toBe(
      '<svg/>',
    );
  });

  it.each([
    ['../outside.svg', 'asset "../outside.svg" is not a safe relative path'],
    ['evil.svg', 'asset "evil.svg" points outside the assets folder'],
    ['missing.svg', 'asset "missing.svg" was not found in the assets folder'],
  ])('refuses %s', async (relativePath, message) => {
    await expect(stageAssets([relativePath], assets(), publicDir())).rejects.toThrow(message);
  });
});
