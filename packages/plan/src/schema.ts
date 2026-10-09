import { z } from 'zod';
import { BrandSchema } from './brand';
import { AudioPath, Slug } from './primitives';

export const PLAN_VERSION = 1;
export const FORMAT = { width: 1080, height: 1920, fps: 30 } as const;
export const MIN_VIDEO_SECONDS = 15;
export const MAX_VIDEO_SECONDS = 60;

export const TRANSITION_KINDS = [
  'cut',
  'fade',
  'slide',
  'wipe',
  'iris',
  'push',
  'whip',
  'zoom-punch',
] as const;
export const DIRECTIONS = ['left', 'right', 'up', 'down'] as const;
export const CAMERA_MOVES = [
  'static',
  'push-in',
  'pull-out',
  'pan-left',
  'pan-right',
  'handheld',
  'rack-focus',
] as const;

const TransitionSchema = z.strictObject({
  kind: z.enum(TRANSITION_KINDS),
  seconds: z.number().min(0.2).max(1).default(0.4),
  /** Where the content travels: "left" means the new scene comes in from the right */
  direction: z.enum(DIRECTIONS).default('left'),
});

const CameraSchema = z.strictObject({
  move: z.enum(CAMERA_MOVES).default('static'),
  intensity: z.enum(['subtle', 'medium', 'strong']).default('medium'),
});

const LightSchema = z.strictObject({
  /** A band of light that crosses the scene once */
  sweep: z.boolean().default(false),
  /** How dark the corners get, 0 = none */
  vignette: z.number().min(0).max(1).default(0.35),
});

const BackgroundSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('solid') }),
  z.strictObject({ kind: z.literal('gradient'), angle: z.number().min(0).max(360).default(160) }),
  z.strictObject({
    kind: z.literal('particles'),
    density: z.enum(['low', 'medium', 'high']).default('medium'),
  }),
  z.strictObject({ kind: z.literal('grain') }),
]);

const TimingSchema = z.discriminatedUnion('kind', [
  /** The scene lasts as long as this voice line (plus a short lead and tail) */
  z.strictObject({ kind: z.literal('line'), lineId: Slug }),
  /** A silent scene of fixed length */
  z.strictObject({ kind: z.literal('seconds'), seconds: z.number().min(0.5).max(15) }),
]);

const SceneSchema = z.strictObject({
  id: Slug,
  piece: Slug,
  /** Checked against the piece's own schema by validatePlan */
  params: z.record(z.string(), z.unknown()),
  timing: TimingSchema,
  camera: CameraSchema.default({ move: 'static', intensity: 'medium' }),
  light: LightSchema.default({ sweep: false, vignette: 0.35 }),
  background: BackgroundSchema.default({ kind: 'gradient', angle: 160 }),
  transitionOut: TransitionSchema.optional(),
});

const VoiceSchema = z.strictObject({
  provider: z.enum(['elevenlabs', 'fake']),
  voiceId: z.string().min(1).max(100),
  /** BCP 47, e.g. "pt-BR" */
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'must look like "pt-BR" or "en"'),
  lines: z.array(z.strictObject({ id: Slug, text: z.string().trim().min(1).max(400) })).min(1).max(20),
});

const MusicSchema = z.strictObject({
  track: AudioPath,
  volume: z.number().min(0).max(1).default(0.22),
  /** Volume while the voice is speaking */
  duckTo: z.number().min(0).max(1).default(0.07),
});

const CaptionsSchema = z.strictObject({
  enabled: z.boolean().default(true),
  position: z.enum(['lower', 'center']).default('lower'),
});

export const PlanSchema = z.strictObject({
  version: z.literal(PLAN_VERSION),
  brand: BrandSchema,
  voice: VoiceSchema,
  music: MusicSchema.optional(),
  captions: CaptionsSchema.default({ enabled: true, position: 'lower' }),
  scenes: z.array(SceneSchema).min(1).max(20),
});

export type Plan = z.output<typeof PlanSchema>;
export type PlanInput = z.input<typeof PlanSchema>;
export type Scene = Plan['scenes'][number];
export type CameraSpec = z.output<typeof CameraSchema>;
export type LightSpec = z.output<typeof LightSchema>;
export type BackgroundSpec = z.output<typeof BackgroundSchema>;
export type TransitionSpec = z.output<typeof TransitionSchema>;
export type TransitionKind = (typeof TRANSITION_KINDS)[number];
export type Direction = (typeof DIRECTIONS)[number];
