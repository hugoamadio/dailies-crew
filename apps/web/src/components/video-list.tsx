import type { VideoStatus } from '@dailies-crew/db';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Dictionary } from '../i18n/dictionary';
import { fill } from '../i18n/locale';
import type { Formatter } from '../lib/format';
import type { VideoRow } from '../lib/loaders/videos-common';
import { Badge, EmptyState, type Tone } from './ui';

const TONES: Record<VideoStatus, Tone> = {
  queued: 'neutral',
  running: 'accent',
  ready_for_review: 'good',
  needs_you: 'warn',
  approved: 'good',
  rejected: 'neutral',
  failed: 'bad',
  paused_budget: 'warn',
};

export function StatusBadge(props: { status: VideoStatus; t: Dictionary; waiting?: boolean }) {
  if (props.waiting) return <Badge tone="warn">{props.t.status.waiting}</Badge>;
  return <Badge tone={TONES[props.status]}>{props.t.status[props.status]}</Badge>;
}

/** Videos as rows: title, line, stage, status and cost; `extra` adds a note or a button per row */
export function VideoList<T extends VideoRow>(props: {
  videos: T[];
  t: Dictionary;
  format: Formatter;
  empty: string;
  extra?: (video: T) => ReactNode;
  waiting?: boolean;
}) {
  const { t, format } = props;
  if (props.videos.length === 0) return <EmptyState>{props.empty}</EmptyState>;
  return (
    <ul className="divide-y divide-line">
      {props.videos.map((video) => (
        <li key={video.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <div className="min-w-0 flex-1">
            <Link
              href={`/videos/${video.id}`}
              className="block truncate font-medium hover:text-accent"
              data-testid="video-link"
            >
              {video.title}
            </Link>
            <p className="truncate text-xs text-muted">
              {video.lineName} · {fill(t.today.atStage, { stage: t.stages[video.stage] })}
              {video.round > 0 ? ` · ${fill(t.today.round, { round: video.round })}` : ''} ·{' '}
              {format.dateTime(video.createdAt)}
            </p>
            {props.extra?.(video)}
          </div>
          <span className="text-xs tabular-nums text-muted">{format.usd(video.costUsd)}</span>
          <StatusBadge status={video.status} t={t} waiting={props.waiting || video.waiting} />
        </li>
      ))}
    </ul>
  );
}
