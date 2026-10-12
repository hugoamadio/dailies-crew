import type { Video } from '@dailies-crew/db';

/** What an output answers: ready to post by hand, or published with a link */
export interface Publication {
  state: 'ready_to_post' | 'published';
  url: string | null;
}

/**
 * Where an approved video goes (spec section 8). Only "manual" exists now; YouTube, TikTok,
 * Instagram and Facebook will implement the same interface.
 */
export interface OutputAdapter {
  readonly name: string;
  publish(video: Video): Promise<Publication>;
}

/** Marks the video ready to post: Hugo downloads it and copies the post texts */
export const manualOutput: OutputAdapter = {
  name: 'manual',
  publish: async () => ({ state: 'ready_to_post', url: null }),
};
