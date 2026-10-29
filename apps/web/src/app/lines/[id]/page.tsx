import { StudioError } from '@dailies-crew/studio';
import { notFound } from 'next/navigation';
import { LineForm } from '../../../components/line-form';
import { RuleItem } from '../../../components/rule-item';
import { Card, EmptyState, PageHeader } from '../../../components/ui';
import { getI18n } from '../../../i18n/server';
import { loadLineForm } from '../../../lib/loaders/lines';
import { getPanel } from '../../../lib/panel';
import { deleteRuleAction, editRuleAction, switchRuleAction, updateLineAction } from '../actions';

export async function generateMetadata() {
  return { title: (await getI18n()).t.lines.editTitle };
}

async function load(id: string) {
  const { ctx } = await getPanel();
  try {
    return await loadLineForm(ctx.db, ctx.dataDir, id);
  } catch (error) {
    if (error instanceof StudioError) notFound();
    throw error;
  }
}

export default async function EditLinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getI18n();
  const form = await load(id);
  const line = form.line!;
  return (
    <>
      <PageHeader title={line.name} description={t.lines.editTitle} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <LineForm
            action={updateLineAction.bind(null, line.id)}
            t={t}
            line={line}
            defaultHour={form.defaultHour}
            timezone={form.timezone}
            products={form.products}
            categories={form.categories}
            music={form.music}
            fonts={form.fonts}
          />
        </div>
        <Card title={t.lines.rules} className="h-fit">
          <p className="mb-3 text-xs text-muted">{t.lines.rulesHint}</p>
          {form.rules.length === 0 ? (
            <EmptyState>{t.lines.noRules}</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {form.rules.map((rule) => (
                <RuleItem
                  key={rule.id}
                  rule={{ id: rule.id, text: rule.text, active: rule.active }}
                  t={t}
                  saveAction={editRuleAction.bind(null, rule.id)}
                  switchAction={switchRuleAction.bind(null, rule.id, !rule.active)}
                  deleteAction={deleteRuleAction.bind(null, rule.id)}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
