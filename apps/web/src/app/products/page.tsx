import Link from 'next/link';
import { ActionButton } from '../../components/action-button';
import { Badge, buttonClass, EmptyState, inputClass, PageHeader } from '../../components/ui';
import { getI18n } from '../../i18n/server';
import { formatter } from '../../lib/format';
import { loadProducts } from '../../lib/loaders/products';
import { getPanel } from '../../lib/panel';
import { switchProductAction } from './actions';

export async function generateMetadata() {
  return { title: (await getI18n()).t.products.title };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const { t, locale } = await getI18n();
  const { ctx } = await getPanel();
  const { products, categories } = await loadProducts(ctx.db, category || undefined);
  const format = formatter(locale, 'UTC');
  const p = t.products;
  return (
    <>
      <PageHeader
        title={p.title}
        description={p.description}
        actions={
          <Link href="/products/new" className={buttonClass('primary')}>
            {t.nav.newProduct}
          </Link>
        }
      />
      {categories.length > 0 ? (
        <form className="mb-6 flex items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium">{p.category}</span>
            <select name="category" defaultValue={category ?? ''} className={inputClass}>
              <option value="">{p.allCategories}</option>
              {categories.map((each) => (
                <option key={each}>{each}</option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonClass('secondary')}>
            {t.common.filter}
          </button>
        </form>
      ) : null}
      {products.length === 0 ? <EmptyState>{p.empty}</EmptyState> : null}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <li
            key={product.id}
            className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm"
          >
            <Link href={`/products/${product.id}`} className="block aspect-[4/3] bg-sunken">
              {product.images[0] ? (
                <img
                  src={`/files/assets/${product.images[0]}`}
                  alt={product.name}
                  className="size-full object-contain p-4"
                />
              ) : null}
            </Link>
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/products/${product.id}`} className="font-semibold hover:text-accent">
                  {product.name}
                </Link>
                <Badge tone={product.active ? 'good' : 'neutral'}>
                  {product.active ? p.active : p.inactive}
                </Badge>
              </div>
              <p className="text-sm">
                <span className="font-medium">
                  {format.price(product.priceCents, product.currency)}
                </span>
                {product.oldPriceCents ? (
                  <span className="ml-2 text-muted line-through">
                    {format.price(product.oldPriceCents, product.currency)}
                  </span>
                ) : null}
                {product.category ? (
                  <span className="ml-2 text-muted">· {product.category}</span>
                ) : null}
              </p>
              <div className="flex gap-2">
                <ActionButton
                  action={switchProductAction.bind(null, product.id, !product.active)}
                  label={product.active ? p.deactivate : p.activate}
                  pendingLabel={t.common.working}
                />
                <Link href={`/products/${product.id}`} className={buttonClass('ghost', 'sm')}>
                  {t.common.edit}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
