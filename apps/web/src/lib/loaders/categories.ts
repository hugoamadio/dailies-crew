import 'server-only';

/** Every category in use among the products, sorted, for the filters and suggestions */
export function categoriesOf(products: { category: string | null }[]): string[] {
  return [...new Set(products.flatMap((product) => product.category ?? []))].sort();
}
