import type { Brand } from './brand';
import type { PieceCatalog } from './catalog';
import type { PlanIssue, Result } from './errors';
import {
  type BackgroundSpec,
  type CameraSpec,
  type Direction,
  FORMAT,
  type LightSpec,
  MAX_VIDEO_SECONDS,
  MIN_VIDEO_SECONDS,
  type Plan,
  type TransitionKind,
} from './schema';
import type { Word } from './words';

export const LEAD_FRAMES = 6;
export const TAIL_FRAMES = 9;

export interface VoiceTrack {
  lineId: string;
  /** Relative to the render's public folder, e.g. "voice/hook.mp3" */
  src: string;
  words: Word[];
  durationSeconds: number;
}

/** Same shape as Remotion's Caption (@remotion/captions) */
export type CaptionWord = {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: null;
  confidence: null;
  pageBreakAfter?: boolean;
};

export type ResolvedTransition = { kind: TransitionKind; direction: Direction; frames: number };

export type ResolvedScene = {
  id: string;
  piece: string;
  params: Record<string, unknown>;
  camera: CameraSpec;
  light: LightSpec;
  background: BackgroundSpec;
  from: number;
  durationInFrames: number;
  transitionOut: ResolvedTransition | null;
};

export type ResolvedVoice = { lineId: string; src: string; from: number; durationInFrames: number };
export type ResolvedMusic = { src: string; volume: number; duckTo: number };

export type ResolvedPlan = {
  version: 1;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  brand: Brand;
  captions: { enabled: boolean; position: 'lower' | 'center'; words: CaptionWord[] };
  scenes: ResolvedScene[];
  voice: ResolvedVoice[];
  music: ResolvedMusic | null;
};

export type PieceLimits = (pieceId: string) => { minSeconds: number; maxSeconds: number };

export function limitsFromCatalog(catalog: PieceCatalog): PieceLimits {
  return (pieceId) => {
    const spec = catalog.get(pieceId);
    if (!spec) throw new Error(`Unknown piece "${pieceId}"`);
    return { minSeconds: spec.minSeconds, maxSeconds: spec.maxSeconds };
  };
}

/**
 * Turns a validated plan plus the measured voice into exact frames.
 *
 * Timing rules:
 * - A scene timed by a voice line has a body of lead + ceil(voiceSeconds × 30) + TAIL_FRAMES
 *   frames, where lead = max(LEAD_FRAMES, round(incomingTransitionFrames / 2)). The body is raised
 *   to the piece's minSeconds if shorter. If it is longer than the piece's maxSeconds, that is an issue.
 * - A silent scene's body is round(seconds × 30).
 * - A transition out of scene i lasts round(seconds × 30) frames (cut = no transition). Scene i's
 *   durationInFrames is body + out, and scene i + 1 starts at from_i + body_i. The transition
 *   therefore covers only scene i's tail and the next scene's lead, never speech.
 * - The voice of a line plays from from + lead, and its caption words get absolute times on the
 *   video timeline.
 * - A scene whose body is shorter than the transition coming into it is an issue. So is a total
 *   length outside MIN_VIDEO_SECONDS..MAX_VIDEO_SECONDS (15-60 s).
 */
export function resolvePlan(
  plan: Plan,
  tracks: readonly VoiceTrack[],
  limits: PieceLimits,
): Result<ResolvedPlan> {
  const { fps } = FORMAT;
  const trackByLine = new Map(tracks.map((track) => [track.lineId, track]));
  const issues: PlanIssue[] = [];
  const scenes: ResolvedScene[] = [];
  const voice: ResolvedVoice[] = [];
  const words: CaptionWord[] = [];
  let from = 0;
  let incoming = 0;

  plan.scenes.forEach((scene, index) => {
    const at = `scenes.${index}`;
    const transition = scene.transitionOut;
    const out = transition && transition.kind !== 'cut' ? Math.round(transition.seconds * fps) : 0;
    const { minSeconds, maxSeconds } = limits(scene.piece);
    let body: number;

    if (scene.timing.kind === 'line') {
      const track = trackByLine.get(scene.timing.lineId);
      if (!track) {
        issues.push({
          path: `${at}.timing.lineId`,
          message: `no voice track for line "${scene.timing.lineId}"`,
        });
        return;
      }
      const lead = Math.max(LEAD_FRAMES, Math.round(incoming / 2));
      const speech = Math.ceil(track.durationSeconds * fps);
      body = Math.max(lead + speech + TAIL_FRAMES, Math.round(minSeconds * fps));
      const voiceFrom = from + lead;
      voice.push({ lineId: track.lineId, src: track.src, from: voiceFrom, durationInFrames: speech });
      track.words.forEach((word, wordIndex) => {
        words.push({
          text: wordIndex === 0 ? word.text : ` ${word.text}`,
          startMs: Math.round((voiceFrom / fps + word.startSeconds) * 1000),
          endMs: Math.round((voiceFrom / fps + word.endSeconds) * 1000),
          timestampMs: null,
          confidence: null,
          ...(wordIndex === track.words.length - 1 ? { pageBreakAfter: true } : {}),
        });
      });
    } else {
      body = Math.round(scene.timing.seconds * fps);
    }

    if (body > Math.round(maxSeconds * fps)) {
      issues.push({
        path: at,
        message: `scene lasts ${(body / fps).toFixed(1)} s, but piece "${scene.piece}" lasts at most ${maxSeconds} s; shorten its voice line or split the scene`,
      });
    }
    if (body < incoming) {
      issues.push({ path: at, message: 'scene is shorter than the transition coming into it' });
    }

    scenes.push({
      id: scene.id,
      piece: scene.piece,
      params: scene.params,
      camera: scene.camera,
      light: scene.light,
      background: scene.background,
      from,
      durationInFrames: body + out,
      transitionOut:
        transition && out > 0
          ? { kind: transition.kind, direction: transition.direction, frames: out }
          : null,
    });
    from += body;
    incoming = out;
  });

  const durationInFrames = from;
  const seconds = durationInFrames / fps;
  if (issues.length === 0 && (seconds < MIN_VIDEO_SECONDS || seconds > MAX_VIDEO_SECONDS)) {
    issues.push({
      path: 'scenes',
      message: `the video lasts ${seconds.toFixed(1)} s; it must last between ${MIN_VIDEO_SECONDS} and ${MAX_VIDEO_SECONDS} s`,
    });
  }
  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      version: 1,
      width: FORMAT.width,
      height: FORMAT.height,
      fps,
      durationInFrames,
      brand: plan.brand,
      captions: { enabled: plan.captions.enabled, position: plan.captions.position, words },
      scenes,
      voice,
      music: plan.music
        ? { src: `assets/${plan.music.track}`, volume: plan.music.volume, duckTo: plan.music.duckTo }
        : null,
    },
  };
}
