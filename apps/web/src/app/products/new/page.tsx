import { CURRENCIES } from '@dailies-crew/studio';
import { ProductForm } from '../../../components/product-form';
import { PageHeader } from '../../../components/ui';
import { getI18n } from '../../../i18n/server';
import { loadProducts } from '../../../lib/loaders/products';
import { getPanel } from '../../../lib/panel';
import { createProductAction } from '../actions';

export async function generateMetadata() {
  return { title: (await getI18n()).t.products.newTitle };
}

export default async function NewProductPage() {
  const { t } = await getI18n();
  const { ctx } = await getPanel();
  const { categories } = await loadProducts(ctx.db);
  return (
    <>
      <PageHeader title={t.products.newTitle} description={t.products.description} />
      <ProductForm
        action={createProductAction}
        t={t}
        product={null}
        categories={categories}
        currencies={CURRENCIES}
      />
    </>
  );
}
