import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { filesFrom, withUploads } from './uploads';

let dataDir: string;
beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dailies-web-uploads-'));
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('uploads', () => {
  it('skips the empty file a browser sends when nothing was picked', () => {
    const form = new FormData();
    form.append('photos', new File([], ''));
    form.append('photos', new File(['<svg/>'], 'lamp.svg'));
    form.append('photos', 'not a file');
    expect(filesFrom(form, 'photos').map((file) => file.name)).toEqual(['lamp.svg']);
  });

  it('writes the files for the service and removes them afterwards, even when it fails', async () => {
    const files = [
      new File(['<svg/>'], 'Luminária Lua.svg'),
      new File(['<svg/>'], 'Luminária Lua.svg'),
    ];
    let seen: string[] = [];
    await withUploads(dataDir, files, async (paths) => {
      seen = paths;
      expect(paths.map((file) => path.basename(file))).toEqual([
        'Luminaria-Lua.svg',
        'Luminaria-Lua.svg',
      ]);
      expect(new Set(paths).size).toBe(2);
      expect(await fs.readFile(paths[0]!, 'utf8')).toBe('<svg/>');
    });
    expect(seen.some((file) => existsSync(file))).toBe(false);
    await expect(
      withUploads(dataDir, files, async () => {
        throw new Error('the service refused');
      }),
    ).rejects.toThrow('the service refused');
    expect(await fs.readdir(path.join(dataDir, 'tmp', 'uploads'))).toEqual([]);
  });

  it('refuses a file that is not an image before writing anything', async () => {
    await expect(
      withUploads(dataDir, [new File(['x'], 'notes.txt')], async () => 'never'),
    ).rejects.toThrow('"notes.txt" is not an image');
    expect(existsSync(path.join(dataDir, 'tmp'))).toBe(false);
  });
});
