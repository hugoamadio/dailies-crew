'use client';

import {
  ChevronDown,
  Clapperboard,
  Factory,
  type LucideIcon,
  Menu,
  Package,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { cx } from './ui';

const ICONS = {
  today: Sun,
  lines: Factory,
  products: Package,
  videos: Clapperboard,
  settings: Settings,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;
export interface NavLink {
  href: string;
  label: string;
  badge?: number;
}
export type NavEntry =
  | ({ kind: 'link'; icon: NavIcon } & NavLink)
  | { kind: 'group'; id: string; icon: NavIcon; label: string; links: NavLink[] };

const OPEN_KEY = 'dailies-nav-open';

/** The link whose href is the longest prefix of the path ("/lines/<id>" lights "All lines") */
function activeHref(entries: NavEntry[], pathname: string): string | null {
  const hrefs = entries.flatMap((entry) =>
    entry.kind === 'link' ? [entry.href] : entry.links.map((link) => link.href),
  );
  const matches = hrefs.filter(
    (href) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`)),
  );
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

function Item(props: { link: NavLink; active: boolean; icon?: NavIcon; nested?: boolean }) {
  const Icon = props.icon ? ICONS[props.icon] : null;
  return (
    <Link
      href={props.link.href}
      aria-current={props.active ? 'page' : undefined}
      className={cx(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
        props.nested && 'pl-10',
        props.active
          ? 'bg-accent-soft font-medium text-accent'
          : 'text-muted hover:bg-sunken hover:text-ink',
      )}
    >
      {Icon ? <Icon size={18} aria-hidden /> : null}
      <span className="flex-1">{props.link.label}</span>
      {props.link.badge ? (
        <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">
          {props.link.badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Hugo's default panel layout: navigation in a left sidebar, pages with subpages as groups that
 * open and close (remembered in this browser), and a drawer on phone width.
 */
export function Sidebar(props: {
  title: string;
  entries: NavEntry[];
  footer: ReactNode;
  menuLabel: string;
  closeLabel: string;
}) {
  const pathname = usePathname();
  const active = activeHref(props.entries, pathname);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    try {
      setOpen(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}') as Record<string, boolean>);
    } catch {
      // storage blocked or broken: every group stays open
    }
  }, []);
  useEffect(() => setDrawer(false), [pathname]);

  const toggle = (id: string) => {
    const next = { ...open, [id]: !(open[id] ?? true) };
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next));
    } catch {
      // the choice just lasts until the page reloads
    }
  };

  const nav = (
    <nav className="flex h-full flex-col" aria-label={props.title}>
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-on-accent">
            <Clapperboard size={16} aria-hidden />
          </span>
          {props.title}
        </Link>
        <button
          type="button"
          className="rounded-lg p-1.5 text-muted hover:bg-sunken lg:hidden"
          onClick={() => setDrawer(false)}
          aria-label={props.closeLabel}
        >
          <X size={18} aria-hidden />
        </button>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto px-3">
        {props.entries.map((entry) =>
          entry.kind === 'link' ? (
            <li key={entry.href}>
              <Item link={entry} icon={entry.icon} active={active === entry.href} />
            </li>
          ) : (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => toggle(entry.id)}
                aria-expanded={open[entry.id] ?? true}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-sunken hover:text-ink"
              >
                {(() => {
                  const Icon = ICONS[entry.icon];
                  return <Icon size={18} aria-hidden />;
                })()}
                <span className="flex-1 text-left">{entry.label}</span>
                <ChevronDown
                  size={16}
                  aria-hidden
                  className={cx('transition-transform', !(open[entry.id] ?? true) && '-rotate-90')}
                />
              </button>
              {(open[entry.id] ?? true) ? (
                <ul className="mt-1 space-y-1">
                  {entry.links.map((link) => (
                    <li key={link.href}>
                      <Item link={link} nested active={active === link.href} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ),
        )}
      </ul>
      <div className="border-t border-line px-5 py-4">{props.footer}</div>
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-panel/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          className="rounded-lg p-1.5 text-muted hover:bg-sunken"
          onClick={() => setDrawer(true)}
          aria-label={props.menuLabel}
          aria-expanded={drawer}
        >
          <Menu size={20} aria-hidden />
        </button>
        <span className="font-semibold">{props.title}</span>
      </div>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-panel lg:block">
        {nav}
      </aside>
      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={props.closeLabel}
            onClick={() => setDrawer(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-panel shadow-xl">
            {nav}
          </aside>
        </div>
      ) : null}
    </>
  );
}
