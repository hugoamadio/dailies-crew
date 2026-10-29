import { Card, PageHeader } from '../../../components/ui';
import { VideoList } from '../../../components/video-list';
import { getI18n } from '../../../i18n/server';
import { formatter } from '../../../lib/format';
import { loadReviewQueue } from '../../../lib/loaders/videos';
import { getPanel } from '../../../lib/panel';

export async function generateMetadata() {
  return { title: (await getI18n()).t.videos.reviewTitle };
}

export default async function ReviewPage() {
  const { t, locale } = await getI18n();
  const { ctx } = await getPanel();
  const { videos, timezone } = await loadReviewQueue(ctx.db);
  return (
    <>
      <PageHeader title={t.videos.reviewTitle} description={t.videos.reviewDescription} />
      <Card>
        <VideoList
          videos={videos}
          t={t}
          format={formatter(locale, timezone)}
          empty={t.videos.reviewEmpty}
        />
      </Card>
    </>
  );
}
