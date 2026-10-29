import { StudioError } from '@dailies-crew/studio';
import { Download } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { retryAction } from '../../actions';
import { ActionButton } from '../../../components/action-button';
import { BehindTheScenes } from '../../../components/behind-the-scenes';
import { LiveRefresh } from '../../../components/live-refresh';
import { PhoneFrame } from '../../../components/phone-frame';
import { PostTexts } from '../../../components/post-texts';
import { RejectForm } from '../../../components/reject-form';
import { buttonClass, Card, PageHeader } from '../../../components/ui';
import { StatusBadge } from '../../../components/video-list';
import { fill } from '../../../i18n/locale';
import { getI18n } from '../../../i18n/server';
import { formatter } from '../../../lib/format';
import { loadVideo } from '../../../lib/loaders/videos';
import { getPanel } from '../../../lib/panel';
import { approveAction, rejectAction } from '../actions';

export async function generateMetadata() {
  return { title: (await getI18n()).t.videos.reviewTitle };
}

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getI18n();
  const { ctx } = await getPanel();
  const data = await loadVideo(ctx.db, id).catch((error: unknown) => {
    if (error instanceof StudioError) notFound();
    throw error;
  });
  const { video } = data;
  const format = formatter(locale, data.timezone);
  const v = t.videos;
  const facts: [string, string][] = [
    [v.line, video.lineName],
    ...(video.productId ? ([[v.product, video.title]] as [string, string][]) : []),
    [v.created, format.dateTime(video.createdAt)],
    [v.round, String(video.round)],
    ...(video.durationSeconds
      ? ([[v.length, format.seconds(video.durationSeconds)]] as [string, string][])
      : []),
    [v.cost, format.usd(video.costUsd)],
  ];
  return (
    <>
      <LiveRefresh active={data.live} />
      <PageHeader
        title={video.title}
        description={video.lineName}
        actions={
          <Link href="/videos/review" className={buttonClass('ghost')}>
            {v.backToReview}
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <PhoneFrame src={data.videoUrl} poster={data.frames[0]} empty={v.noVideoFile} />
          {data.downloadUrl ? (
            <a href={data.downloadUrl} className={`${buttonClass('secondary')} w-full`} download>
              <Download size={16} aria-hidden />
              {v.download}
            </a>
          ) : null}
        </div>
        <div className="space-y-6">
          <Card>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <StatusBadge status={video.status} t={t} waiting={video.waiting} />
              {data.live ? (
                <span className="text-sm text-muted">
                  {fill(v.working, { stage: t.stages[video.stage] })}
                </span>
              ) : null}
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {video.status === 'failed' && !video.waiting ? (
              <div className="mt-4 space-y-2 rounded-lg bg-bad-soft p-3 text-sm text-bad">
                <p>
                  {fill(v.failedAt, {
                    stage: t.stages[video.stage],
                    reason: video.failureReason ?? '',
                  })}
                </p>
                <ActionButton
                  action={retryAction.bind(null, video.id)}
                  label={t.today.tryAgain}
                  pendingLabel={t.common.working}
                  showDone
                />
              </div>
            ) : null}
            {video.waiting ? (
              <p className="mt-4 rounded-lg bg-warn-soft p-3 text-sm text-warn">
                {video.status === 'paused_budget' ? t.today.waitingCap : t.today.waitingKey}
              </p>
            ) : null}
            {video.problems.length > 0 ? (
              <div className="mt-4 rounded-lg bg-warn-soft p-3 text-sm">
                <h3 className="mb-1 font-semibold text-warn">{v.problems}</h3>
                <ul className="list-disc space-y-1 pl-5">
                  {video.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {video.status === 'approved' && video.publication?.at ? (
              <p className="mt-4 rounded-lg bg-good-soft p-3 text-sm text-good">
                {fill(v.readyToPost, { when: format.dateTime(new Date(video.publication.at)) })}
              </p>
            ) : null}
          </Card>
          {data.decidable ? (
            <Card title={v.decide}>
              <div className="space-y-2">
                {data.canApprove ? null : <p className="text-sm text-warn">{v.noRender}</p>}
                <ActionButton
                  action={approveAction.bind(null, video.id)}
                  label={v.approve}
                  pendingLabel={v.approving}
                  variant="primary"
                  size="md"
                  disabled={!data.canApprove}
                  showDone
                />
              </div>
              <div className="mt-5 border-t border-line pt-5">
                <RejectForm action={rejectAction.bind(null, video.id)} t={t} />
              </div>
            </Card>
          ) : null}
          <Card title={v.posts}>
            <PostTexts posts={data.posts} t={t} />
          </Card>
        </div>
      </div>
      <div className="mt-6">
        <BehindTheScenes data={data} t={t} format={format} />
      </div>
    </>
  );
}
