import 'server-only';
import type { Stage, VideoStatus } from '@dailies-crew/db';
import { RESUMABLE_FAILURES } from '@dailies-crew/studio';

/** One video as the lists show it */
export interface VideoRow {
  id: string;
  /** The product's name, or the line's for brand and topic videos */
  title: string;
  lineName: string;
  status: VideoStatus;
  stage: Stage;
  round: number;
  costUsd: number;
  failureReason: string | null;
  createdAt: Date;
  /** Stopped by a key, credit or cap problem: shown as waiting, not as failed */
  waiting?: boolean;
}

export function toRow(video: {
  id: string;
  status: VideoStatus;
  stage: Stage;
  round: number;
  costUsd: number;
  failureReason: string | null;
  createdAt: Date;
  line: { name: string };
  product: { name: string } | null;
}): VideoRow {
  return {
    id: video.id,
    title: video.product?.name ?? video.line.name,
    lineName: video.line.name,
    status: video.status,
    stage: video.stage,
    round: video.round,
    costUsd: video.costUsd,
    failureReason: video.failureReason,
    createdAt: video.createdAt,
  };
}

/**
 * A video stopped by a refused key, missing credit or a cap is waiting, not broken: it goes on
 * with "Resume" (design brief). Anything else that failed (e.g. "interrupted") needs "Try again".
 */
export function isWaiting(video: { status: VideoStatus; failureKind: string | null }): boolean {
  if (video.status === 'paused_budget') return true;
  return video.status === 'failed' && RESUMABLE_FAILURES.includes(video.failureKind ?? '');
}

export const IN_PROGRESS: VideoStatus[] = ['queued', 'running'];
