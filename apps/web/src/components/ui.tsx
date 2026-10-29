import type { ReactNode } from 'react';

/** Small hand-written building blocks: no component library (design brief) */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function buttonClass(variant: ButtonVariant = 'secondary', size: 'sm' | 'md' = 'md') {
  return cx(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-sm',
    variant === 'primary' && 'bg-accent text-on-accent hover:opacity-90',
    variant === 'secondary' && 'border border-line bg-panel text-ink hover:bg-sunken',
    variant === 'danger' && 'border border-line bg-panel text-bad hover:bg-bad-soft',
    variant === 'ghost' && 'text-muted hover:bg-sunken hover:text-ink',
  );
}

export const fileInputClass =
  'block w-full text-sm text-muted file:mr-3 file:h-9 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-panel file:px-3 file:text-sm file:font-medium file:text-ink hover:file:bg-sunken';

export const inputClass =
  'block w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none';

export function PageHeader(props: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{props.title}</h1>
        {props.description ? <p className="mt-1 text-sm text-muted">{props.description}</p> : null}
      </div>
      {props.actions ? <div className="flex flex-wrap gap-2">{props.actions}</div> : null}
    </header>
  );
}

export function Card(props: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx('rounded-2xl border border-line bg-panel p-5 shadow-sm', props.className)}
    >
      {props.title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {props.title}
          </h2>
          {props.aside}
        </div>
      ) : null}
      {props.children}
    </section>
  );
}

export type Tone = 'neutral' | 'accent' | 'good' | 'warn' | 'bad';

export function Badge(props: { tone?: Tone; children: ReactNode }) {
  const tone = props.tone ?? 'neutral';
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-sunken text-muted',
        tone === 'accent' && 'bg-accent-soft text-accent',
        tone === 'good' && 'bg-good-soft text-good',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'bad' && 'bg-bad-soft text-bad',
      )}
    >
      {props.children}
    </span>
  );
}

export function EmptyState(props: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
      {props.children}
    </p>
  );
}

/** A spending bar: spent against a cap (caps are soft, so it can pass 100 %) */
export function Meter(props: { value: number; max: number; label: string }) {
  const ratio = props.max > 0 ? props.value / props.max : 0;
  const tone = ratio >= 1 ? 'bg-bad' : ratio >= 0.8 ? 'bg-warn' : 'bg-accent';
  return (
    <div>
      <div
        className="h-2 overflow-hidden rounded-full bg-sunken"
        role="meter"
        aria-label={props.label}
        aria-valuemin={0}
        aria-valuemax={props.max}
        aria-valuenow={props.value}
      >
        <div
          className={cx('h-full rounded-full', tone)}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function Field(props: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={props.className}>
      <label htmlFor={props.name} className="mb-1 block text-sm font-medium">
        {props.label}
      </label>
      {props.children}
      {props.error ? (
        <p id={`${props.name}-error`} className="mt-1 text-xs text-bad">
          {props.error}
        </p>
      ) : props.hint ? (
        <p className="mt-1 text-xs text-muted">{props.hint}</p>
      ) : null}
    </div>
  );
}
