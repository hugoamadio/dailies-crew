import fs from 'node:fs/promises';
import path from 'node:path';
import { resetDb, testDb } from '@dailies-crew/db/test';
import { getProduct } from '@dailies-crew/studio';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LAMP_SVG, LOGO_SVG, tempDataDir } from '../../../../../packages/studio/test/fixtures';
import { formOf, t, testPanel, upload } from '../../test/panel';
import { loadProducts } from '../loaders/products';
import { createProductFromForm, switchProduct, updateProductFromForm } from './products';

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

function productForm(fields: Record<string, string | File | File[]> = {}) {
  return formOf({
    name: 'Luminária Lua',
    description: 'A moon lamp printed in 3D, layer by layer.',
    priceCents: '89,90',
    oldPriceCents: '129.90',
    currency: 'BRL',
    category: 'lamps',
    link: '',
    active: 'on',
    ...fields,
  });
}

describe('product actions', () => {
  it('creates a product with several uploaded photos, the first one first', async () => {
    const panel = testPanel(db, dataDir);
    const { id, state } = await createProductFromForm(
      panel,
      productForm({ photos: [await upload(LAMP_SVG), await upload(LOGO_SVG)] }),
      t,
    );
    expect(state).toEqual({ status: 'ok', message: 'Product saved.' });
    const product = await getProduct(db, id);
    expect(product).toMatchObject({
      priceCents: 8990,
      oldPriceCents: 12990,
      link: null,
      images: [`products/${id}/1-lamp.svg`, `products/${id}/2-logo.svg`],
    });
    await expect(
      fs.access(path.join(dataDir, 'assets', product.images[1]!)),
    ).resolves.toBeUndefined();
  });

  it('refuses a product without photos', async () => {
    await expect(createProductFromForm(testPanel(db, dataDir), productForm(), t)).rejects.toThrow(
      'A product needs at least one image',
    );
  });

  it('edits the fields, keeps the photos unless new ones come, and switches the product off', async () => {
    const panel = testPanel(db, dataDir);
    const { id } = await createProductFromForm(
      panel,
      productForm({ photos: await upload(LAMP_SVG) }),
      t,
    );
    await updateProductFromForm(panel, id, productForm({ name: 'Luminária Sol', category: '' }), t);
    expect(await getProduct(db, id)).toMatchObject({
      name: 'Luminária Sol',
      category: null,
      images: [`products/${id}/1-lamp.svg`],
    });
    await updateProductFromForm(panel, id, productForm({ photos: await upload(LOGO_SVG) }), t);
    expect((await getProduct(db, id)).images).toEqual([`products/${id}/2-logo.svg`]);
    expect(await switchProduct(panel, id, false, t)).toEqual({
      status: 'ok',
      message: 'The product is inactive: lines skip it.',
    });
    expect((await getProduct(db, id)).active).toBe(false);
  });

  it('lists products by category', async () => {
    const panel = testPanel(db, dataDir);
    const photo = await upload(LAMP_SVG);
    await createProductFromForm(panel, productForm({ photos: photo }), t);
    await createProductFromForm(
      panel,
      productForm({ name: 'Vase', category: 'vases', photos: photo }),
      t,
    );
    const all = await loadProducts(db);
    expect(all.categories).toEqual(['lamps', 'vases']);
    expect(all.products).toHaveLength(2);
    expect((await loadProducts(db, 'vases')).products.map((product) => product.name)).toEqual([
      'Vase',
    ]);
  });
});
