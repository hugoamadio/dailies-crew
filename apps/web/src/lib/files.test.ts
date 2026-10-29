import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { downloadName, parseRange, resolveDataFile } from './files';

let base: string;
let dataDir: string;
beforeEach(async () => {
  base = await fs.mkdtemp(path.join(os.tmpdir(), 'dailies-web-files-'));
  dataDir = path.join(base, 'data');
  await fs.mkdir(path.join(dataDir, 'jobs/v1/frames'), { recursive: true });
  await fs.writeFile(path.join(dataDir, 'jobs/v1/video.mp4'), 'twelve bytes');
  await fs.writeFile(path.join(dataDir, 'jobs/v1/frames/element-0.jpeg'), 'jpeg');
  await fs.writeFile(path.join(dataDir, 'jobs/v1/voice-cache.json'), '{}');
  await fs.writeFile(path.join(base, 'secret.png'), 'outside');
  await fs.writeFile(path.join(base, '.env'), 'KEY=1');
});
afterEach(async () => {
  await fs.rm(base, { recursive: true, force: true });
});

describe('resolveDataFile', () => {
  it('finds an allowed file inside the data folder, with its size and type', async () => {
    expect(await resolveDataFile(dataDir, ['jobs', 'v1', 'video.mp4'])).toEqual({
      file: path.join(await fs.realpath(dataDir), 'jobs/v1/video.mp4'),
      size: 12,
      type: 'video/mp4',
    });
    expect((await resolveDataFile(dataDir, ['jobs', 'v1', 'frames', 'element-0.jpeg']))?.type).toBe(
      'image/jpeg',
    );
  });

  it('refuses climbing out, absolute paths, odd characters and NUL', async () => {
    for (const segments of [
      ['..', 'secret.png'],
      ['jobs', '..', '..', 'secret.png'],
      ['.', 'jobs', 'v1', 'video.mp4'],
      ['', 'etc', 'passwd.png'],
      ['/etc/passwd.png'],
      ['jobs', 'v1', 'video.mp4\0.png'],
      ['jobs/v1', 'video.mp4'],
      ['jobs', 'v1', 'vídeo.mp4'],
    ]) {
      expect(await resolveDataFile(dataDir, segments), segments.join('/')).toBeNull();
    }
  });

  it('refuses types outside the allow-list, folders and missing files', async () => {
    expect(await resolveDataFile(dataDir, ['jobs', 'v1', 'voice-cache.json'])).toBeNull();
    expect(await resolveDataFile(dataDir, ['..', '.env'])).toBeNull();
    expect(await resolveDataFile(dataDir, ['jobs', 'v1', 'missing.mp4'])).toBeNull();
    await fs.mkdir(path.join(dataDir, 'folder.png'));
    expect(await resolveDataFile(dataDir, ['folder.png'])).toBeNull();
  });

  it('refuses a symbolic link that points outside the data folder', async () => {
    await fs.symlink(path.join(base, 'secret.png'), path.join(dataDir, 'link.png'));
    expect(await resolveDataFile(dataDir, ['link.png'])).toBeNull();
    await fs.symlink(path.join(dataDir, 'jobs/v1/video.mp4'), path.join(dataDir, 'inside.mp4'));
    expect((await resolveDataFile(dataDir, ['inside.mp4']))?.size).toBe(12);
  });
});

describe('parseRange', () => {
  it('reads one range with both ends, an open end, or a suffix', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=-5000', 1000)).toEqual({ start: 0, end: 999 });
  });

  it('answers unsatisfiable past the end, and the whole file for anything it does not take', () => {
    expect(parseRange('bytes=1000-', 1000)).toBe('unsatisfiable');
    expect(parseRange('bytes=-0', 1000)).toBe('unsatisfiable');
    expect(parseRange(null, 1000)).toBeNull();
    expect(parseRange('items=0-1', 1000)).toBeNull();
    expect(parseRange('bytes=0-1,5-6', 1000)).toBeNull();
    expect(parseRange('bytes=9-2', 1000)).toBeNull();
    expect(parseRange('bytes=-', 1000)).toBeNull();
    expect(parseRange('bytes=abc', 1000)).toBeNull();
  });
});

describe('downloadName', () => {
  it('keeps safe characters only, and the real extension', () => {
    expect(downloadName('Luminária Lua 2026-10-12.mp4', 'video.mp4', '.mp4')).toBe(
      'Lumin-ria-Lua-2026-10-12.mp4',
    );
    expect(downloadName('../../x', 'video.mp4', '.mp4')).toBe('x.mp4');
    expect(downloadName(null, 'video.mp4', '.mp4')).toBe('video.mp4');
    expect(downloadName('', 'my video.mp4', '.mp4')).toBe('my-video.mp4');
  });

  it('never lets the requested name change the extension', () => {
    expect(downloadName('x.html', 'logo.svg', '.svg')).toBe('x.svg');
    expect(downloadName('x.svg.html', 'logo.svg', '.svg')).toBe('x.svg.svg');
    expect(downloadName('page.HTML', 'a.png', '.png')).toBe('page.png');
    expect(downloadName('x', 'logo.svg', '.svg')).toBe('x.svg');
  });
});
