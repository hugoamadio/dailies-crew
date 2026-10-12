import path from 'node:path';
import type { Db, Product } from '@dailies-crew/db';
import { imageExtension, importAsset, isUuid, safeFileName } from '../assets';
import { parseInput, StudioError } from '../errors';
import { ProductInputSchema } from './schema';

export const MAX_PRODUCT_IMAGES = 10;

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
  if (imageFiles.length === 0) throw new StudioError('A product needs at least one image');
  if (imageFiles.length > MAX_PRODUCT_IMAGES) {
    throw new StudioError(`A product takes at most ${MAX_PRODUCT_IMAGES} images`);
  }
  for (const file of imageFiles) imageExtension(file);
  return ctx.db.$transaction(async (tx) => {
    const product = await tx.product.create({ data: { ...data, images: [] } });
    const images: string[] = [];
    for (const [index, file] of imageFiles.entries()) {
      const name = `${index + 1}-${safeFileName(path.basename(file))}`;
      images.push(await importAsset(ctx.dataDir, file, `products/${product.id}/${name}`));
    }
    return tx.product.update({ where: { id: product.id }, data: { images } });
  });
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
