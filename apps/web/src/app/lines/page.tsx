import Link from 'next/link';
import { ActionButton } from '../../components/action-button';
import { RunNowForm } from '../../components/run-now-form';
import {
  Badge,
  buttonClass,
  Card,
  EmptyState,
  Meter,
  PageHeader,
  type Tone,
} from '../../components/ui';
import { fill } from '../../i18n/locale';
import { getI18n } from '../../i18n/server';
import { formatter } from '../../lib/format';
import { type LineState, loadLines } from '../../lib/loaders/lines';
import { getPanel } from '../../lib/panel';
import { runNowAction, switchLineAction } from './actions';

export async function generateMetadata() {
  return { title: (await getI18n()).t.lines.title };
}

const STATE_TONES: Record<LineState, Tone> = {
  on: 'good',
  pausedByYou: 'neutral',
  pausedCap: 'warn',
  stopped: 'bad',
};

export default async function LinesPage() {
  const { t, locale } = await getI18n();
  const { ctx } = await getPanel();
  const { lines, timezone } = await loadLines(ctx.db, ctx.now());
  const format = formatter(locale, timezone);
  const l = t.lines;
  const stateLabel: Record<LineState, string> = {
    on: l.on,
    pausedByYou: l.pausedByYou,
    pausedCap: l.pausedCap,
    stopped: l.stopped,
  };
  return (
    <>
      <PageHeader
        title={l.title}
        description={l.description}
        actions={
          <Link href="/lines/new" className={buttonClass('primary')}>
            {t.nav.newLine}
          </Link>
        }
      />
      {lines.length === 0 ? <EmptyState>{l.empty}</EmptyState> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {lines.map((line) => (
          <Card key={line.id}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/lines/${line.id}`}
                  className="block truncate text-lg font-semibold hover:text-accent"
                >
                  {line.name}
                </Link>
                <p className="text-sm text-muted">
                  {l.kinds[line.kind]} · {fill(l.perDayAt, { count: line.perDay, hour: line.hour })}
                </p>
              </div>
              <Badge tone={STATE_TONES[line.state]}>{stateLabel[line.state]}</Badge>
            </div>
            {line.state === 'pausedCap' && line.pausedReason ? (
              <p className="mb-3 text-xs text-warn">{line.pausedReason}</p>
            ) : null}
            {line.warning ? (
              <p className="mb-3 text-xs text-warn">
                {fill(l.lastWarning, { warning: line.warning })}
              </p>
            ) : null}
            <p className="mb-1 text-xs text-muted">
              {fill(l.monthSpend, {
                spent: format.usd(line.monthSpend),
                cap: format.usd(line.monthlyCapUsd),
              })}
            </p>
            <Meter value={line.monthSpend} max={line.monthlyCapUsd} label={line.name} />
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
              <RunNowForm
                action={runNowAction.bind(null, line.id)}
                label={l.runNow}
                countLabel={l.runCount}
                pendingLabel={t.common.working}
                defaultCount={line.perDay}
              />
              <div className="flex items-start gap-2">
                <ActionButton
                  action={switchLineAction.bind(null, line.id, !line.active)}
                  label={line.active ? l.pause : l.turnOn}
                  pendingLabel={t.common.working}
                  variant={line.active ? 'secondary' : 'primary'}
                />
                <Link href={`/lines/${line.id}`} className={buttonClass('ghost', 'sm')}>
                  {t.common.edit}
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
