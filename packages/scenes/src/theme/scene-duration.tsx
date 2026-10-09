import { createContext, useContext } from 'react';
import { useVideoConfig } from 'remotion';

/** The length of the scene being drawn, when it is shorter than the composition (inside a transition series) */
export const SceneDurationContext = createContext<number | null>(null);

/** Frames the current scene lasts: what the camera, light and background spread their move across */
export function useSceneDuration(): number {
  const provided = useContext(SceneDurationContext);
  const { durationInFrames } = useVideoConfig();
  return provided ?? durationInFrames;
}
