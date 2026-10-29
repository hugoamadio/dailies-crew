import { LineForm } from '../../../components/line-form';
import { PageHeader } from '../../../components/ui';
import { getI18n } from '../../../i18n/server';
import { loadLineForm } from '../../../lib/loaders/lines';
import { getPanel } from '../../../lib/panel';
import { createLineAction } from '../actions';

export async function generateMetadata() {
  return { title: (await getI18n()).t.lines.newTitle };
}

export default async function NewLinePage() {
  const { t } = await getI18n();
  const { ctx } = await getPanel();
  const form = await loadLineForm(ctx.db, ctx.dataDir);
  return (
    <>
      <PageHeader title={t.lines.newTitle} />
      <LineForm
        action={createLineAction}
        t={t}
        line={null}
        defaultHour={form.defaultHour}
        timezone={form.timezone}
        products={form.products}
        categories={form.categories}
        music={form.music}
        fonts={form.fonts}
      />
    </>
  );
}
