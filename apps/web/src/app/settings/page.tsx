import { KeyCheckButton } from '../../components/key-check';
import { SettingsForm } from '../../components/settings-form';
import { Badge, Card, PageHeader } from '../../components/ui';
import { getI18n } from '../../i18n/server';
import { loadSettings } from '../../lib/loaders/settings';
import { getPanel } from '../../lib/panel';
import { checkKeysAction, saveSettingsAction } from './actions';

export async function generateMetadata() {
  return { title: (await getI18n()).t.settings.title };
}

export default async function SettingsPage() {
  const { t } = await getI18n();
  const panel = await getPanel();
  const data = await loadSettings(panel.ctx.db, panel.env);
  const s = t.settings;
  return (
    <>
      <PageHeader title={s.title} description={s.description} />
      <div className="space-y-6">
        <Card title={s.keys}>
          <p className="mb-4 text-xs text-muted">{s.keysHint}</p>
          <ul className="mb-4 space-y-2 text-sm">
            {(['anthropic', 'elevenlabs'] as const).map((name) => (
              <li key={name} className="flex items-center justify-between gap-3">
                <span>{s[name]}</span>
                <Badge tone={data.keys[name] ? 'good' : 'warn'}>
                  {data.keys[name] ? s.configured : s.missing}
                </Badge>
              </li>
            ))}
          </ul>
          {data.keys.fakeAi ? (
            <p className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-accent">{s.fakeAi}</p>
          ) : null}
          {data.keys.fakeAi && data.keys.realVoice ? (
            <p className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-accent">{s.realVoice}</p>
          ) : null}
          <KeyCheckButton action={checkKeysAction} t={t} />
        </Card>
        <SettingsForm action={saveSettingsAction} t={t} data={data} />
      </div>
    </>
  );
}
