import 'server-only';
import type { Db, Stage, VideoStatus } from '@dailies-crew/db';
import {
  type Briefing,
  getSettings,
  listVideos,
  REVIEW_FOCUSES,
  type Review,
  type ReviewFocus,
  type Script,
  SOCIAL_NETWORKS,
  type SocialPosts,
  STAGES,
  videoDetails,
} from '@dailies-crew/studio';
import { IN_PROGRESS, isWaiting, toRow } from './videos-common';

// Mirrors DECIDABLE in packages/studio/src/decisions/service.ts (not exported from the studio index)
const DECIDABLE: VideoStatus[] = ['ready_for_review', 'needs_you'];

/** "Review": what waits for Hugo, the oldest first */
export async function loadReviewQueue(db: Db) {
  const [settings, videos] = await Promise.all([
    getSettings(db),
    db.video.findMany({
      where: { status: { in: DECIDABLE } },
      include: { line: { select: { name: true } }, product: { select: { name: true } } },
      orderBy: [{ readyAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
    }),
  ]);
  return { timezone: settings.timezone, videos: videos.map(toRow) };
}

/** "All videos": the latest 100, of one status when filtered */
export async function loadAllVideos(db: Db, status?: VideoStatus) {
  const [settings, videos] = await Promise.all([
    getSettings(db),
    listVideos(db, { status, limit: 100 }),
  ]);
  return {
    timezone: settings.timezone,
    videos: videos.map((video) => ({ ...toRow(video), waiting: isWaiting(video) })),
  };
}

/** What the stage runs store: { outcome, data } (packages/studio/src/pipeline/runner.ts) */
function dataOf<T>(output: unknown): T | null {
  return ((output as { data?: T } | null)?.data ?? null) as T | null;
}

/**
 * Everything the review page and "behind the scenes" show about one video. Costs per stage are
 * summed from the cost entries (a superseded attempt's StageRun.costUsd can be 0); a cost with
 * no stage is the rejection router.
 */
export async function loadVideo(db: Db, id: string) {
  const [settings, video] = await Promise.all([getSettings(db), videoDetails(db, id)]);
  const costByStage = new Map<Stage | null, number>();
  for (const cost of video.costs) {
    costByStage.set(cost.stage, (costByStage.get(cost.stage) ?? 0) + cost.usd);
  }
  const reviewRounds = video.stageRuns
    .filter((run) => run.stage === 'review' && run.status === 'done')
    .map((run) => {
      const verdicts = dataOf<Record<ReviewFocus, Review>>(run.output);
      return {
        round: run.round,
        verdicts: REVIEW_FOCUSES.flatMap((focus) =>
          verdicts?.[focus] ? [{ focus, ...verdicts[focus] }] : [],
        ),
      };
    });
  const social = video.social as SocialPosts | null;
  return {
    timezone: settings.timezone,
    video: {
      ...toRow(video),
      productId: video.productId,
      lineId: video.lineId,
      failureKind: video.failureKind,
      problems: video.problems,
      durationSeconds: video.durationSeconds,
      publication: video.publication as { state?: string; at?: string } | null,
      decidedAt: video.decidedAt,
      waiting: isWaiting(video),
    },
    /** The render, with its last change in the URL so a redone video is never a cached one */
    videoUrl: video.videoFile ? `/files/${video.videoFile}?v=${video.updatedAt.getTime()}` : null,
    downloadUrl: video.videoFile
      ? `/files/${video.videoFile}?download=dailies-${video.id.slice(0, 8)}.mp4`
      : null,
    frames: video.frameFiles.map((frame) => `/files/${frame}?v=${video.updatedAt.getTime()}`),
    decidable: DECIDABLE.includes(video.status),
    canApprove: DECIDABLE.includes(video.status) && video.videoFile !== null,
    live: IN_PROGRESS.includes(video.status),
    posts: social
      ? SOCIAL_NETWORKS.flatMap((network) =>
          social[network] ? [{ network, ...social[network] }] : [],
        )
      : [],
    briefing: video.briefing as Briefing | null,
    script: video.script as Script | null,
    plan: video.plan as { scenes?: unknown[] } | null,
    ideas: video.ideas.map((idea) => ({
      id: idea.id,
      style: idea.style,
      title: idea.title,
      hook: idea.hook,
      angle: idea.angle,
      cta: idea.cta,
      status: idea.status,
      total: idea.total,
      scores: (idea.scores ?? {}) as Record<string, { score: number; reason: string }>,
    })),
    reviewRounds,
    decisions: video.decisions,
    costs: [
      ...STAGES.flatMap((stage) =>
        costByStage.has(stage)
          ? [{ stage: stage as Stage | null, usd: costByStage.get(stage)! }]
          : [],
      ),
      ...(costByStage.has(null) ? [{ stage: null, usd: costByStage.get(null)! }] : []),
    ],
    stageRuns: video.stageRuns.map((run) => ({
      id: run.id,
      stage: run.stage,
      round: run.round,
      attempt: run.attempt,
      status: run.status,
      costUsd: run.costUsd,
      error: run.error,
      startedAt: run.startedAt,
    })),
  };
}

export type LoadedVideo = Awaited<ReturnType<typeof loadVideo>>;
