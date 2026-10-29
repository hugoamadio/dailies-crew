import fs from 'node:fs/promises';
import path from 'node:path';
import type { Db } from '@dailies-crew/db';
import { createLine, createProduct, getSettings, type SocialPosts } from '@dailies-crew/studio';
import { PNG } from 'pngjs';
import { TINY_MP4_BASE64 } from './tiny-video';
import { LAMP_SVG, LOGO_SVG } from './env';

/** A solid 36×64 frame (9:16) as a PNG */
function frame(red: number, green: number, blue: number): Buffer {
  const png = new PNG({ width: 36, height: 64 });
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = red;
    png.data[index + 1] = green;
    png.data[index + 2] = blue;
    png.data[index + 3] = 255;
  }
  return PNG.sync.write(png);
}

const POST = {
  title: 'Luminária Lua: a moon on your desk',
  description: 'Printed in 3D, layer by layer. Link in bio.',
  hashtags: ['#luminaria', '#impressao3d'],
};
const SOCIAL: SocialPosts = { youtube: POST, tiktok: POST, instagram: POST, facebook: POST };

/** A video the crews finished: a real tiny MP4, three review frames, post texts */
async function readyVideo(db: Db, dataDir: string, lineId: string, productId: string) {
  const video = await db.video.create({ data: { lineId, productId, status: 'queued' } });
  const job = path.join(dataDir, 'jobs', video.id);
  await fs.mkdir(path.join(job, 'frames'), { recursive: true });
  await fs.writeFile(path.join(job, 'video.mp4'), Buffer.from(TINY_MP4_BASE64, 'base64'));
  const frames: string[] = [];
  for (const [index, color] of [
    [109, 40, 217],
    [245, 158, 11],
    [16, 185, 129],
  ].entries()) {
    await fs.writeFile(
      path.join(job, 'frames', `element-${index}.png`),
      frame(color[0]!, color[1]!, color[2]!),
    );
    frames.push(`jobs/${video.id}/frames/element-${index}.png`);
  }
  return db.video.update({
    where: { id: video.id },
    data: {
      status: 'ready_for_review',
      stage: 'social',
      videoFile: `jobs/${video.id}/video.mp4`,
      frameFiles: frames,
      durationSeconds: 2,
      social: SOCIAL,
      briefing: {
        summary: 'A short video about the moon lamp for people who like design.',
        keyFacts: ['Printed in 3D', 'R$ 89,90'],
        mustAvoid: [],
      },
      script: {
        lines: [
          {
            id: 'hook',
            text: 'Have you seen a moon on a desk?',
            purpose: 'hook',
            estimatedSeconds: 3,
          },
          {
            id: 'show',
            text: 'Printed in 3D, layer by layer.',
            purpose: 'product',
            estimatedSeconds: 4,
          },
          { id: 'cta', text: 'Link in bio.', purpose: 'call to action', estimatedSeconds: 2 },
        ],
        notes: '',
      },
      readyAt: new Date(),
    },
  });
}

/**
 * The panel's test data: one product line, one product, and two videos ready for review (one to
 * approve, one to reject). Tables and data folder start empty.
 */
export async function seed(db: Db, dataDir: string) {
  await getSettings(db);
  const ctx = { db, dataDir };
  const line = await createLine(
    ctx,
    {
      name: 'Store products',
      kind: 'product',
      material: { select: 'all' },
      perDay: 1,
      hour: 9,
      language: 'pt-BR',
      objective: 'sell the product: take people to the link in the bio',
      audience: 'people who like design and 3D printed decoration',
      tone: 'energetic and warm',
      brand: {
        colors: {
          background: '#0f0f14',
          surface: '#1c1c24',
          text: '#ffffff',
          primary: '#7c3aed',
          accent: '#f59e0b',
        },
        headingFont: 'Montserrat',
        bodyFont: 'Inter',
        personality: 'energetic',
      },
      voice: { provider: 'fake', voiceId: 'demo' },
      monthlyCapUsd: 10,
      // no daily run starts during the tests
      active: false,
    },
    { logoFile: LOGO_SVG },
  );
  const product = await createProduct(
    ctx,
    {
      name: 'Luminária Lua',
      description: 'A moon lamp printed in 3D, layer by layer, that lights up in 3 colors.',
      priceCents: 8990,
      oldPriceCents: 12990,
      category: 'lamps',
    },
    [LAMP_SVG],
  );
  const toApprove = await readyVideo(db, dataDir, line.id, product.id);
  const toReject = await readyVideo(db, dataDir, line.id, product.id);
  return { lineId: line.id, productId: product.id, toApprove: toApprove.id, toReject: toReject.id };
}
