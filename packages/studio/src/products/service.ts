import path from 'node:path';
import type { Db, Product } from '@dailies-crew/db';
import { imageExtension, importAsset, isUuid, safeFileName } from '../assets';
import { parseInput, StudioError } from '../errors';
import { ProductInputSchema, ProductPatchSchema } from './schema';

export const MAX_PRODUCT_IMAGES = 10;

function checkImages(imageFiles: readonly string[]): void {
  if (imageFiles.length === 0) throw new StudioError('A product needs at least one image');
  if (imageFiles.length > MAX_PRODUCT_IMAGES) {
    throw new StudioError(`A product takes at most ${MAX_PRODUCT_IMAGES} images`);
  }
  for (const file of imageFiles) imageExtension(file);
}

/** Copies the photos as products/<id>/<n>-<name>, numbering from `first` */
async function importImages(
  dataDir: string,
  productId: string,
  imageFiles: readonly string[],
  first: number,
): Promise<string[]> {
  const images: string[] = [];
  for (const [index, file] of imageFiles.entries()) {
    const name = `${first + index}-${safeFileName(path.basename(file))}`;
    images.push(await importAsset(dataDir, file, `products/${productId}/${name}`));
  }
  return images;
}

/**
 * Saves a product and copies its photos to data/assets/products/<id>/<n>-<name>. The first photo
 * is the main one: the crews use it for the product scenes.
 */
export async function createProduct(
  ctx: { db: Db; dataDir: string },
  input: unknown,
  imageFiles: readonly string[],
): Promise<Product> {
  const data = parseInput(ProductInputSchema, input, 'product');
  checkImages(imageFiles);
  return ctx.db.$transaction(async (tx) => {
    const product = await tx.product.create({ data: { ...data, images: [] } });
    const images = await importImages(ctx.dataDir, product.id, imageFiles, 1);
    return tx.product.update({ where: { id: product.id }, data: { images } });
  });
}

/** The number after the highest "<n>-" prefix of the product's photos */
function nextImageNumber(images: readonly string[]): number {
  const numbers = images.map((image) => Number(/\/(\d+)-[^/]*$/.exec(image)?.[1] ?? 0));
  return Math.max(0, ...numbers) + 1;
}

/**
 * Changes the given fields. New photos, when given, replace the list (numbered after the old
 * ones); the old files stay on disk because earlier videos' plans may point at them.
 */
export async function updateProduct(
  ctx: { db: Db; dataDir: string },
  id: string,
  patch: unknown,
  imageFiles: readonly string[] = [],
): Promise<Product> {
  const changes = parseInput(ProductPatchSchema, patch, 'product changes');
  const current = await getProduct(ctx.db, id);
  const data = parseInput(
    ProductInputSchema,
    {
      name: changes.name ?? current.name,
      description: changes.description ?? current.description,
      priceCents: changes.priceCents ?? current.priceCents,
      oldPriceCents:
        changes.oldPriceCents === undefined ? current.oldPriceCents : changes.oldPriceCents,
      currency: changes.currency ?? current.currency,
      category: changes.category === undefined ? current.category : changes.category,
      link: changes.link === undefined ? current.link : changes.link,
      active: current.active,
    },
    'product',
  );
  if (imageFiles.length > 0) checkImages(imageFiles);
  const images =
    imageFiles.length > 0
      ? await importImages(ctx.dataDir, id, imageFiles, nextImageNumber(current.images))
      : current.images;
  return ctx.db.product.update({ where: { id }, data: { ...data, images } });
}

export async function getProduct(db: Db, id: string): Promise<Product> {
  const product = isUuid(id) ? await db.product.findUnique({ where: { id } }) : null;
  if (!product) throw new StudioError(`No product with id ${id}`);
  return product;
}

export async function listProducts(db: Db): Promise<Product[]> {
  return db.product.findMany({ orderBy: { createdAt: 'asc' } });
}

export async function setProductActive(db: Db, id: string, active: boolean): Promise<Product> {
  await getProduct(db, id);
  return db.product.update({ where: { id }, data: { active } });
}
