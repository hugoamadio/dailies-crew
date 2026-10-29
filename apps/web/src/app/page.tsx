import Link from 'next/link';
import { ActionButton } from '../components/action-button';
import { LiveRefresh } from '../components/live-refresh';
import { Card, EmptyState, Meter, PageHeader } from '../components/ui';
import { VideoList } from '../components/video-list';
import { getI18n } from '../i18n/server';
import { fill } from '../i18n/locale';
import { formatter } from '../lib/format';
import { loadToday } from '../lib/loaders/today';
import { getPanel } from '../lib/panel';
import { retryAction } from './actions';

export async function generateMetadata() {
  return { title: (await getI18n()).t.today.title };
}

export default async function TodayPage() {
  const { t, locale } = await getI18n();
  const { ctx } = await getPanel();
  const today = await loadToday(ctx.db, ctx.now());
  const format = formatter(locale, today.timezone);
  const { groups } = today;
  const month = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(today.month.year, today.month.month - 1, 15)));
  const nothing = Object.values(groups).every((group) => group.length === 0);
  const list = (videos: typeof groups.ready) => (
    <VideoList videos={videos} t={t} format={format} empty={t.today.nothing} />
  );

  return (
    <>
      <LiveRefresh active={today.live} />
      <PageHeader title={t.today.title} description={t.today.description} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {nothing ? <EmptyState>{t.today.noVideos}</EmptyState> : null}
          {groups.needsYou.length > 0 ? (
            <Card title={t.today.needsYou}>{list(groups.needsYou)}</Card>
          ) : null}
          {groups.ready.length > 0 ? <Card title={t.today.ready}>{list(groups.ready)}</Card> : null}
          {groups.inProduction.length > 0 ? (
            <Card title={t.today.inProduction}>{list(groups.inProduction)}</Card>
          ) : null}
          {groups.waiting.length > 0 ? (
            <Card title={t.today.waiting}>
              <VideoList
                videos={groups.waiting}
                t={t}
                format={format}
                empty={t.today.nothing}
                waiting
                extra={(video) => (
                  <p className="mt-1 text-xs text-warn">
                    {video.why === 'cap' ? t.today.waitingCap : t.today.waitingKey}
                  </p>
                )}
              />
            </Card>
          ) : null}
          {groups.failed.length > 0 ? (
            <Card title={t.today.failed}>
              <VideoList
                videos={groups.failed}
                t={t}
                format={format}
                empty={t.today.nothing}
                extra={(video) => (
                  <div className="mt-2 space-y-2">
                    {video.failureReason ? (
                      <p className="text-xs text-bad">{video.failureReason}</p>
                    ) : null}
                    <ActionButton
                      action={retryAction.bind(null, video.id)}
                      label={t.today.tryAgain}
                      pendingLabel={t.common.working}
                    />
                  </div>
                )}
              />
            </Card>
          ) : null}
          {groups.decided.length > 0 ? (
            <Card title={t.today.decided}>{list(groups.decided)}</Card>
          ) : null}
        </div>
        <div className="space-y-6">
          <Card title={fill(t.today.spending, { month })}>
            <p className="mb-2 text-2xl font-semibold tabular-nums">
              {fill(t.today.spentOfCap, {
                spent: format.usd(today.monthSpend),
                cap: format.usd(today.globalCapUsd),
              })}
            </p>
            <Meter
              value={today.monthSpend}
              max={today.globalCapUsd}
              label={fill(t.today.spending, { month })}
            />
            {today.lines.length > 0 ? (
              <>
                <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {t.today.perLine}
                </h3>
                <ul className="space-y-3">
                  {today.lines.map((line) => (
                    <li key={line.id}>
                      <div className="mb-1 flex justify-between gap-2 text-sm">
                        <Link href={`/lines/${line.id}`} className="truncate hover:text-accent">
                          {line.name}
                        </Link>
                        <span className="shrink-0 tabular-nums text-muted">
                          {fill(t.today.spentOfCap, {
                            spent: format.usd(line.monthSpend),
                            cap: format.usd(line.monthlyCapUsd),
                          })}
                        </span>
                      </div>
                      <Meter value={line.monthSpend} max={line.monthlyCapUsd} label={line.name} />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Card>
          <Card title={t.today.nextRuns}>
            {today.nextRuns.length === 0 ? (
              <p className="text-sm text-muted">{t.today.noActiveLines}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {today.nextRuns.map((run) => (
                  <li key={run.id} className="flex justify-between gap-2">
                    <span className="truncate">{run.name}</span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {format.dateTime(run.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
