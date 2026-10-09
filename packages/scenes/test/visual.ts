import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderStill, selectComposition } from '@remotion/renderer';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { expect } from 'vitest';
import { DEMO_BRAND } from '../src/demo';
import type { PiecePreviewProps } from '../src/PiecePreview';
import { pieceCatalog } from '../src/specs';
import { CONTENT_AREA, SAFE_AREA } from '../src/theme/safe-area';

const here = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(here, '../src/index.ts');
const PUBLIC_DIR = path.join(here, 'fixtures/public');
const SNAPSHOTS = path.join(here, '__snapshots__');
const ACTUAL = path.join(here, '__actual__');
const DIFF = path.join(here, '__diff__');
/** Share of the pixels that may change (font anti-aliasing) before a frame counts as different */
const MAX_DIFF_RATIO = 0.005;

let serveUrl: Promise<string> | undefined;
function getServeUrl(): Promise<string> {
  serveUrl ??= (async () => {
    await ensureBrowser();
    return bundle({ entryPoint: ENTRY, publicDir: PUBLIC_DIR, enableCaching: true });
  })();
  return serveUrl;
}

export async function renderComposition(
  id: string,
  inputProps: Record<string, unknown>,
  frame: number,
  name: string,
): Promise<string> {
  const url = await getServeUrl();
  const composition = await selectComposition({ serveUrl: url, id, inputProps });
  await fs.mkdir(ACTUAL, { recursive: true });
  const output = path.join(ACTUAL, `${name}.png`);
  await renderStill({ composition, serveUrl: url, output, frame, inputProps, imageFormat: 'png' });
  return output;
}

/** A missing reference is created locally (look at it before committing) but fails when CI is set. */
export async function expectSnapshot(name: string, actualFile: string): Promise<void> {
  const reference = path.join(SNAPSHOTS, `${name}.png`);
  if (!existsSync(reference) && process.env.CI && process.env.UPDATE_SNAPSHOTS !== '1') {
    throw new Error(
      `Missing reference test/__snapshots__/${name}.png: run npm run test:visual locally and commit the new reference`,
    );
  }
  if (process.env.UPDATE_SNAPSHOTS === '1' || !existsSync(reference)) {
    await fs.mkdir(SNAPSHOTS, { recursive: true });
    await fs.copyFile(actualFile, reference);
    return;
  }
  const actual = PNG.sync.read(await fs.readFile(actualFile));
  const expected = PNG.sync.read(await fs.readFile(reference));
  expect([actual.width, actual.height]).toEqual([expected.width, expected.height]);
  const diff = new PNG({ width: actual.width, height: actual.height });
  const changed = pixelmatch(actual.data, expected.data, diff.data, actual.width, actual.height, {
    threshold: 0.12,
  });
  const ratio = changed / (actual.width * actual.height);
  if (ratio > MAX_DIFF_RATIO) {
    await fs.mkdir(DIFF, { recursive: true });
    await fs.writeFile(path.join(DIFF, `${name}.png`), PNG.sync.write(diff));
  }
  expect(
    ratio,
    `${name}: ${(ratio * 100).toFixed(2)}% of the pixels changed (see test/__diff__/${name}.png)`,
  ).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

type PreviewOptions = Partial<Omit<PiecePreviewProps, 'pieceId'>> & { frame: number };

/** Renders one frame of a piece (its example params unless given) and compares it with its reference */
export async function expectPieceSnapshot(
  name: string,
  pieceId: string,
  options: PreviewOptions,
): Promise<string> {
  const spec = pieceCatalog.get(pieceId);
  if (!spec) throw new Error(`Unknown piece "${pieceId}"`);
  const { frame, ...rest } = options;
  const props: PiecePreviewProps = {
    pieceId,
    params: spec.paramsSchema.parse(rest.params ?? spec.example),
    brand: rest.brand ?? DEMO_BRAND,
    camera: rest.camera ?? { move: 'static', intensity: 'medium' },
    light: rest.light ?? { sweep: false, vignette: 0.35 },
    background: rest.background ?? { kind: 'gradient', angle: 160 },
    seconds: rest.seconds ?? 3,
  };
  const file = await renderComposition('PiecePreview', props, frame, name);
  await expectSnapshot(name, file);
  return file;
}

type Region = (x: number, y: number, width: number, height: number) => boolean;

/** Fails when more than 0.1% of the sampled pixels of the region differ from the background color */
async function expectRegionEmpty(
  file: string,
  backgroundHex: string,
  inRegion: Region,
  message: string,
) {
  const png = PNG.sync.read(await fs.readFile(file));
  const background = [1, 3, 5].map((offset) =>
    Number.parseInt(backgroundHex.slice(offset, offset + 2), 16),
  );
  let drawn = 0;
  let checked = 0;
  for (let y = 0; y < png.height; y += 2) {
    for (let x = 0; x < png.width; x += 2) {
      if (!inRegion(x, y, png.width, png.height)) continue;
      checked += 1;
      const index = (y * png.width + x) * 4;
      const differs = [0, 1, 2].some(
        (channel) => Math.abs((png.data[index + channel] ?? 0) - (background[channel] ?? 0)) > 24,
      );
      if (differs) drawn += 1;
    }
  }
  expect(drawn / checked, `${path.basename(file)} ${message}`).toBeLessThanOrEqual(0.001);
}

/**
 * Fails when anything but the background color was drawn outside the content area (the margins
 * the social apps cover, plus the caption band). Render with a solid background to use it.
 */
export async function expectMarginsEmpty(file: string, backgroundHex: string): Promise<void> {
  await expectRegionEmpty(
    file,
    backgroundHex,
    (x, y, width, height) =>
      !(
        x >= CONTENT_AREA.left &&
        x < width - CONTENT_AREA.right &&
        y >= CONTENT_AREA.top &&
        y < height - CONTENT_AREA.bottom
      ),
    'draws outside the content area',
  );
}

/** Like expectMarginsEmpty, but only the left and right margins over the full height (captions live in the caption band) */
export async function expectSideMarginsEmpty(file: string, backgroundHex: string): Promise<void> {
  await expectRegionEmpty(
    file,
    backgroundHex,
    (x, _y, width) => x < SAFE_AREA.left || x >= width - SAFE_AREA.right,
    'draws in the side margins',
  );
}
