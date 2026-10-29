'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Reloads the page's data every few seconds while something is queued or running, and stops when
 * nothing is (design brief: polling with router.refresh(), no websockets). Hidden tabs skip a beat.
 */
export function LiveRefresh({ active, everyMs = 3000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, everyMs);
    return () => clearInterval(timer);
  }, [active, everyMs, router]);
  return null;
}
