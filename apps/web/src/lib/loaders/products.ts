import 'server-only';
import type { Db } from '@dailies-crew/db';
import { listProducts } from '@dailies-crew/studio';
import { categoriesOf } from './categories';

/** "All products", optionally of one category, and every category for the filter */
export async function loadProducts(db: Db, category?: string) {
  const products = await listProducts(db);
  return {
    categories: categoriesOf(products),
    products: category ? products.filter((product) => product.category === category) : products,
  };
}
