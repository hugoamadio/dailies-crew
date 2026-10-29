import { getSettings, workerOnline } from '@dailies-crew/studio';
import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { resumeAction, setLocaleAction } from '../app/actions';
import type { Dictionary } from '../i18n/dictionary';
import { fill, type Locale, LOCALES } from '../i18n/locale';
import { formatter } from '../lib/format';
import { getPanel } from '../lib/panel';
import { ActionButton } from './action-button';
import { LiveRefresh } from './live-refresh';
import { type NavEntry, Sidebar } from './sidebar';
import { cx } from './ui';

function Code({ children }: { children: string }) {
  return (
    <code className="whitespace-nowrap rounded bg-sunken px-1 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

/** "Worker offline: run {command}" with the command as code */
function withCommand(template: string, command: string) {
  const [before, after] = template.split('{command}');
  return (
    <>
      {before}
      <Code>{command}</Code>
      {after}
    </>
  );
}

function LanguageSwitch({ locale, label }: { locale: Locale; label: string }) {
  return (
    <form action={setLocaleAction} className="flex items-center gap-1" aria-label={label}>
      {LOCALES.map((each) => (
        <button
          key={each}
          type="submit"
          name="locale"
          value={each}
          aria-pressed={each === locale}
          className={cx(
            'rounded-md px-2 py-1 text-xs font-semibold',
            each === locale ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-sunken',
          )}
        >
          {each === 'en' ? 'EN' : 'PT'}
        </button>
      ))}
    </form>
  );
}

/** The database is down: say how to start it instead of failing every page */
export function DatabaseDown({ t, message }: { t: Dictionary; message?: string }) {
  // a message is a StudioError's own text (e.g. DATABASE_URL missing); without one the database is down
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">
        {message ? t.shell.startFailedTitle : t.shell.dbDownTitle}
      </h1>
      <p className="mt-3 text-muted">
        {message ?? withCommand(t.shell.dbDownBody, 'npm run db:up')}
      </p>
    </main>
  );
}

/** Sidebar, global warning and worker state around every page */
export async function Shell(props: { locale: Locale; t: Dictionary; children: ReactNode }) {
  const { t, locale } = props;
  const { ctx } = await getPanel();
  const [settings, online, waiting] = await Promise.all([
    getSettings(ctx.db),
    workerOnline(ctx.db),
    ctx.db.video.count({ where: { status: { in: ['ready_for_review', 'needs_you'] } } }),
  ]);
  const format = formatter(locale, settings.timezone);
  const entries: NavEntry[] = [
    { kind: 'link', icon: 'today', href: '/', label: t.nav.today },
    {
      kind: 'group',
      id: 'lines',
      icon: 'lines',
      label: t.nav.lines,
      links: [
        { href: '/lines', label: t.nav.allLines },
        { href: '/lines/new', label: t.nav.newLine },
      ],
    },
    {
      kind: 'group',
      id: 'products',
      icon: 'products',
      label: t.nav.products,
      links: [
        { href: '/products', label: t.nav.allProducts },
        { href: '/products/new', label: t.nav.newProduct },
      ],
    },
    {
      kind: 'group',
      id: 'videos',
      icon: 'videos',
      label: t.nav.videos,
      links: [
        { href: '/videos/review', label: t.nav.review, badge: waiting },
        { href: '/videos', label: t.nav.allVideos },
      ],
    },
    { kind: 'link', icon: 'settings', href: '/settings', label: t.nav.settings },
  ];
  const footer = (
    <div className="space-y-3 text-xs">
      <p className="flex items-start gap-2" data-testid="worker-state">
        <span
          className={cx('mt-1 size-2 shrink-0 rounded-full', online ? 'bg-good' : 'bg-bad')}
          aria-hidden
        />
        <span className={online ? 'text-muted' : 'text-bad'}>
          {online ? t.shell.workerOnline : withCommand(t.shell.workerOffline, 'npm run worker')}
        </span>
      </p>
      <div className="flex items-center justify-between">
        <span className="text-muted">{t.shell.language}</span>
        <LanguageSwitch locale={locale} label={t.shell.language} />
      </div>
    </div>
  );
  return (
    <div className="min-h-dvh">
      <Sidebar
        title={t.common.appName}
        entries={entries}
        footer={footer}
        menuLabel={t.nav.menu}
        closeLabel={t.nav.close}
      />
      <div className="lg:pl-64">
        {settings.warning ? (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 border-b border-line bg-bad-soft px-4 py-3 text-sm text-bad sm:px-8"
          >
            <TriangleAlert size={18} aria-hidden />
            <p className="flex-1">
              <strong>{t.shell.stoppedTitle}.</strong>{' '}
              {fill(settings.warningAt ? t.shell.stoppedBody : t.shell.stoppedBodyNoTime, {
                since: settings.warningAt ? format.dateTime(settings.warningAt) : '',
                warning: settings.warning.replace(/[.\s]+$/, ''),
              })}
            </p>
            <ActionButton
              action={resumeAction}
              label={t.shell.resume}
              pendingLabel={t.shell.resuming}
              variant="primary"
              showDone
            />
          </div>
        ) : null}
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{props.children}</main>
      </div>
      {/* the worker's state and the review count stay fresh even on a quiet page */}
      <LiveRefresh active everyMs={30_000} />
    </div>
  );
}
