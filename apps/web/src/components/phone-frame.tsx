import type { ReactNode } from 'react';

/** The video as it shows on a phone: 9:16, native controls (seeking works: the files route answers ranges) */
export function PhoneFrame(props: { src: string | null; poster?: string; empty: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[2.6rem] border border-line bg-ink/90 p-3 shadow-xl dark:bg-black">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[2rem] bg-black">
        {props.src ? (
          <video
            key={props.src}
            src={props.src}
            poster={props.poster}
            controls
            playsInline
            preload="metadata"
            className="size-full object-contain"
            data-testid="review-video"
          />
        ) : (
          <div className="grid size-full place-items-center p-6 text-center text-sm text-white/70">
            {props.empty}
          </div>
        )}
      </div>
    </div>
  );
}
