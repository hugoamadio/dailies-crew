import type { Dictionary } from '../i18n/dictionary';
import { CopyButton } from './copy-button';

export interface Post {
  network: 'youtube' | 'tiktok' | 'instagram' | 'facebook';
  title: string;
  description: string;
  hashtags: string[];
}

/** The post texts per network, each part with its own copy button */
export function PostTexts({ posts, t }: { posts: Post[]; t: Dictionary }) {
  const v = t.videos;
  if (posts.length === 0) return <p className="text-sm text-muted">{v.noPosts}</p>;
  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const hashtags = post.hashtags.join(' ');
        const all = `${post.title}\n\n${post.description}\n\n${hashtags}`;
        return (
          <article
            key={post.network}
            className="rounded-xl border border-line p-4"
            data-testid="post"
          >
            <header className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-semibold">{v.networks[post.network]}</h3>
              <CopyButton text={all} label={v.copyAll} copiedLabel={v.copied} />
            </header>
            <dl className="space-y-2 text-sm">
              {(
                [
                  [v.postTitle, post.title],
                  [v.postDescription, post.description],
                  [v.hashtags, hashtags],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="flex items-center justify-between text-xs text-muted">
                    {label}
                    <CopyButton text={value} label={v.copy} copiedLabel={v.copied} />
                  </dt>
                  <dd className="whitespace-pre-line">{value}</dd>
                </div>
              ))}
            </dl>
          </article>
        );
      })}
    </div>
  );
}
