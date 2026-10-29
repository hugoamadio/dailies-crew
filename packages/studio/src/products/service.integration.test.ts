import fs from 'node:fs/promises';
import path from 'node:path';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LAMP_SVG, productInput, productLineInput, tempDataDir } from '../../test/fixtures';
import { createLine } from '../lines/service';
import { chooseMaterial } from '../material';
import { createProduct, listProducts, setProductActive, updateProduct } from './service';

const db = testDb();
let dataDir: string;
beforeEach(async () => {
  await resetDb(db);
  dataDir = await tempDataDir();
});
afterEach(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});
afterAll(async () => {
  await db.$disconnect();
});

describe('product service', () => {
  it('saves the product and copies its photos under assets/products/<id>', async () => {
    const product = await createProduct({ db, dataDir }, productInput(), [LAMP_SVG, LAMP_SVG]);
    expect(product.images).toEqual([
      `products/${product.id}/1-lamp.svg`,
      `products/${product.id}/2-lamp.svg`,
    ]);
    for (const image of product.images) {
      await expect(fs.access(path.join(dataDir, 'assets', image))).resolves.toBeUndefined();
    }
    expect(product).toMatchObject({ priceCents: 8990, currency: 'BRL', active: true });
  });

  it('refuses a product without photos, a file that is not an image, and a wrong old price', async () => {
    await expect(createProduct({ db, dataDir }, productInput(), [])).rejects.toThrow(
      'A product needs at least one image',
    );
    await expect(
      createProduct({ db, dataDir }, productInput(), ['/tmp/notes.txt']),
    ).rejects.toThrow('"notes.txt" is not an image');
    await expect(
      createProduct({ db, dataDir }, productInput({ oldPriceCents: 100 }), [LAMP_SVG]),
    ).rejects.toThrow('oldPriceCents must be higher than priceCents');
    expect(await listProducts(db)).toEqual([]);
  });
});

describe('updateProduct', () => {
  it('changes the given fields and keeps the rest, checking the prices together', async () => {
    const product = await createProduct({ db, dataDir }, productInput(), [LAMP_SVG]);
    const updated = await updateProduct({ db, dataDir }, product.id, {
      name: 'Luminária Sol',
      priceCents: 7990,
      category: null,
    });
    expect(updated).toMatchObject({
      name: 'Luminária Sol',
      priceCents: 7990,
      oldPriceCents: 12990,
      category: null,
      images: product.images,
    });
    await expect(updateProduct({ db, dataDir }, product.id, { priceCents: 20000 })).rejects.toThrow(
      'oldPriceCents must be higher than priceCents',
    );
    await expect(updateProduct({ db, dataDir }, product.id, { active: false })).rejects.toThrow(
      'Invalid product changes',
    );
  });

  it('replaces the photos with new ones numbered after the old, leaving the old files', async () => {
    const product = await createProduct({ db, dataDir }, productInput(), [LAMP_SVG, LAMP_SVG]);
    const updated = await updateProduct({ db, dataDir }, product.id, {}, [LAMP_SVG]);
    expect(updated.images).toEqual([`products/${product.id}/3-lamp.svg`]);
    for (const image of [...product.images, ...updated.images]) {
      await expect(fs.access(path.join(dataDir, 'assets', image))).resolves.toBeUndefined();
    }
  });
});

describe('chooseMaterial', () => {
  it('picks the line products that never got a video, and warns when there is none', async () => {
    const line = await createLine({ db, dataDir }, productLineInput());
    const now = new Date();
    expect(await chooseMaterial(db, line, 2, now)).toEqual({
      ok: false,
      warning: 'Nothing to show: no active product exists',
    });

    const first = await createProduct({ db, dataDir }, productInput({ name: 'First' }), [LAMP_SVG]);
    const second = await createProduct({ db, dataDir }, productInput({ name: 'Second' }), [
      LAMP_SVG,
    ]);
    await db.video.create({ data: { lineId: line.id, productId: first.id } });
    expect(await chooseMaterial(db, line, 1, now)).toEqual({ ok: true, productIds: [second.id] });

    await setProductActive(db, second.id, false);
    expect(await chooseMaterial(db, line, 2, now)).toEqual({
      ok: true,
      productIds: [first.id, first.id],
    });
  });

  it('gives brand and topic lines one empty slot per video', async () => {
    const line = await createLine(
      { db, dataDir },
      productLineInput({ kind: 'topic', material: { subject: 'Tips for 3D printing' } }),
    );
    expect(await chooseMaterial(db, line, 2, new Date())).toEqual({
      ok: true,
      productIds: [null, null],
    });
  });
});
