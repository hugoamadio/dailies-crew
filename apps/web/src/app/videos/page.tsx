import type { VideoStatus } from '@dailies-crew/db';
import { LiveRefresh } from '../../components/live-refresh';
import { buttonClass, Card, inputClass, PageHeader } from '../../components/ui';
import { VideoList } from '../../components/video-list';
import { getI18n } from '../../i18n/server';
import { formatter } from '../../lib/format';
import { loadAllVideos } from '../../lib/loaders/videos';
import { getPanel } from '../../lib/panel';

const STATUSES: VideoStatus[] = [
  'queued',
  'running',
  'ready_for_review',
  'needs_you',
  'approved',
  'rejected',
  'failed',
  'paused_budget',
];

export async function generateMetadata() {
  return { title: (await getI18n()).t.videos.allTitle };
}

export default async function AllVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = STATUSES.find((each) => each === status);
  const { t, locale } = await getI18n();
  const { ctx } = await getPanel();
  const { videos, timezone } = await loadAllVideos(ctx.db, filter);
  const v = t.videos;
  return (
    <>
      <LiveRefresh
        active={videos.some((video) => video.status === 'queued' || video.status === 'running')}
      />
      <PageHeader title={v.allTitle} description={v.allDescription} />
      <form className="mb-6 flex items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">{v.statusFilter}</span>
          <select name="status" defaultValue={filter ?? ''} className={inputClass}>
            <option value="">{v.allStatuses}</option>
            {STATUSES.map((each) => (
              <option key={each} value={each}>
                {t.status[each]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass('secondary')}>
          {t.common.filter}
        </button>
      </form>
      <Card>
        <VideoList videos={videos} t={t} format={formatter(locale, timezone)} empty={v.empty} />
      </Card>
    </>
  );
}
