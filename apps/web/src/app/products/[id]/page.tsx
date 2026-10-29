import { CURRENCIES, getProduct, StudioError } from '@dailies-crew/studio';
import { notFound } from 'next/navigation';
import { ProductForm } from '../../../components/product-form';
import { PageHeader } from '../../../components/ui';
import { getI18n } from '../../../i18n/server';
import { loadProducts } from '../../../lib/loaders/products';
import { getPanel } from '../../../lib/panel';
import { updateProductAction } from '../actions';

export async function generateMetadata() {
  return { title: (await getI18n()).t.products.editTitle };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getI18n();
  const { ctx } = await getPanel();
  const product = await getProduct(ctx.db, id).catch((error: unknown) => {
    if (error instanceof StudioError) notFound();
    throw error;
  });
  const { categories } = await loadProducts(ctx.db);
  return (
    <>
      <PageHeader title={product.name} description={t.products.editTitle} />
      <ProductForm
        action={updateProductAction.bind(null, product.id)}
        t={t}
        product={product}
        categories={categories}
        currencies={CURRENCIES}
      />
    </>
  );
}
