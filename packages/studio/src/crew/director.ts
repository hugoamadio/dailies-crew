import {
  type Brand,
  CAMERA_MOVES,
  collectAssetPaths,
  DIRECTIONS,
  fakeWords,
  formatIssues,
  limitsFromCatalog,
  type Plan,
  type PlanInput,
  resolvePlan,
  Slug,
  TRANSITION_KINDS,
  validatePlan,
} from '@dailies-crew/plan';
import { pieceCatalog, pieceSpecs } from '@dailies-crew/scenes/specs';
import { z } from 'zod';
import type { LlmRequest } from '../llm/types';
import type { RoleConfig } from '../settings/schema';
import {
  clip,
  instructionsSection,
  joinSections,
  type Material,
  materialSection,
  type Recipe,
  recipeSection,
  rulesSection,
  subjectOf,
} from './context';
import type { IdeaDraft } from './creator';
import type { Briefing } from './preparer';
import type { Script } from './scriptwriter';

export const MAX_DIRECTION_RETRIES = 2;
const PIECE_IDS = pieceSpecs.map((spec) => spec.id) as [string, ...string[]];

/**
 * Structured outputs need a fixed schema with no free-form objects, and every piece has its own
 * params: so the director writes each scene's params as a JSON string, parsed and checked here.
 */
export const DirectorSceneSchema = z.strictObject({
  id: Slug,
  piece: z.enum(PIECE_IDS),
  /** The piece's params as a JSON object, e.g. {"question":"...","emphasis":"..."} */
  paramsJson: z.string().min(2).max(2000),
  /** The voice line this scene shows while it is spoken; null for a silent scene */
  lineId: Slug.nullable(),
  /** Length of a silent scene; null for a scene tied to a voice line */
  seconds: z.number().min(0.5).max(15).nullable(),
  camera: z.strictObject({
    move: z.enum(CAMERA_MOVES),
    intensity: z.enum(['subtle', 'medium', 'strong']),
  }),
  light: z.strictObject({ sweep: z.boolean(), vignette: z.number().min(0).max(1) }),
  background: z.strictObject({
    kind: z.enum(['solid', 'gradient', 'particles', 'grain']),
    /** gradient only */
    angle: z.number().min(0).max(360).nullable(),
    /** particles only */
    density: z.enum(['low', 'medium', 'high']).nullable(),
  }),
  /** null for a cut, and always for the last scene */
  transitionOut: z
    .strictObject({
      kind: z.enum(TRANSITION_KINDS),
      seconds: z.number().min(0.2).max(1),
      direction: z.enum(DIRECTIONS),
    })
    .nullable(),
});

export const DirectorOutputSchema = z.strictObject({
  scenes: z.array(DirectorSceneSchema).min(2).max(20),
  captionsPosition: z.enum(['lower', 'center']),
  /** The director's intent, for the reviewers */
  notes: z.string().max(800),
});
export type DirectorOutput = z.output<typeof DirectorOutputSchema>;
type DirectorScene = DirectorOutput['scenes'][number];

/** What the director reads about a piece: its card ("ficha") */
export interface PieceCard {
  id: string;
  title: string;
  description: string;
  minSeconds: number;
  maxSeconds: number;
  /** Params that are image paths: use only the photos given */
  assetParams: readonly string[];
  paramsSchema: unknown;
  example: Record<string, unknown>;
}

export function pieceCards(): PieceCard[] {
  return pieceSpecs.map((spec) => ({
    id: spec.id,
    title: spec.title,
    description: spec.description,
    minSeconds: spec.minSeconds,
    maxSeconds: spec.maxSeconds,
    assetParams: spec.assetParams,
    paramsSchema: z.toJSONSchema(spec.paramsSchema, { io: 'input', unrepresentable: 'any' }),
    example: spec.example,
  }));
}

/** What the plan takes from the line rather than from the director */
export interface PlanFrame {
  brand: Brand;
  voice: { provider: 'elevenlabs' | 'fake'; voiceId: string };
  language: string;
  musicTrack: string | null;
  /** Asset paths the scenes may show (the product's or the brand's photos) */
  images: string[];
}

export interface DirectFacts {
  recipe: Recipe;
  rules: string[];
  material: Material;
  briefing: Briefing;
  idea: IdeaDraft;
  script: Script;
  frame: PlanFrame;
  pieces: PieceCard[];
  instructions: string[];
  /** What was wrong with the previous attempt of this run */
  previousIssues: string[];
}

const SYSTEM = `You are the director of a crew that makes short vertical videos (1080x1920, 30 fps, 15 to 60 seconds) with a library of animated scene pieces.
You turn the script into a direction plan: an ordered list of scenes. Each scene:
- id: lowercase words joined by dashes, unique;
- piece: one of the library pieces (read their cards: what they show, their params, their minimum and maximum seconds);
- paramsJson: the piece's params as a JSON object string that matches the piece's paramsSchema exactly (no extra keys; mind the maximum lengths);
- lineId: the voice line shown while it is spoken, or null for a short silent scene; then seconds is its length (within the piece's limits);
- camera, light, background and transitionOut (null for a cut, and null on the last scene).
Rules:
- every voice line of the script is used by exactly one scene, in the script's order;
- a scene tied to a line lasts as long as the line is spoken plus about half a second: pick a piece whose maximum seconds fits (about 2.5 words per second);
- the first scene is a hook piece and the last scene is cta-end;
- image params must be one of the photos listed under "Photos you may use", exactly as written;
- texts on screen are short, in the line's language, and never invent facts;
- vary camera moves and transitions with intention; keep it readable.
In notes, explain your intent in two or three sentences for the reviewers.`;

export function buildDirectRequest(
  facts: DirectFacts,
  role: RoleConfig,
): LlmRequest<DirectorOutput> {
  const photos = facts.frame.images.length
    ? ['## Photos you may use', ...facts.frame.images.map((image) => `- ${image}`)].join('\n')
    : '## Photos you may use\n(none: use pieces without images)';
  const retry = facts.previousIssues.length
    ? [
        '## Your previous plan was refused for these reasons; fix every one',
        ...facts.previousIssues,
      ].join('\n')
    : '';
  return {
    role: 'director',
    model: role.model,
    effort: role.effort,
    system: SYSTEM,
    content: [
      {
        type: 'text',
        text: joinSections(
          `## Scene library (piece cards)\n${JSON.stringify(facts.pieces, null, 2)}`,
          recipeSection(facts.recipe),
          `## Brand personality: ${facts.frame.brand.personality}`,
          materialSection(facts.material, facts.recipe.language),
          photos,
          `## Briefing\n${JSON.stringify(facts.briefing, null, 2)}`,
          `## The chosen idea\n${JSON.stringify(facts.idea, null, 2)}`,
          `## The script (voice lines)\n${JSON.stringify(facts.script.lines, null, 2)}`,
          rulesSection(facts.rules),
          instructionsSection(facts.instructions),
          retry,
          'Write the direction plan.',
        ),
      },
    ],
    schema: DirectorOutputSchema,
    maxTokens: 32000,
    facts,
  };
}

function sceneToPlan(scene: DirectorScene, index: number, issues: string[]) {
  let params: unknown;
  try {
    params = JSON.parse(scene.paramsJson);
  } catch {
    issues.push(`- scenes.${index}.paramsJson: not valid JSON`);
  }
  if (
    params !== undefined &&
    (typeof params !== 'object' || params === null || Array.isArray(params))
  ) {
    issues.push(`- scenes.${index}.paramsJson: must be a JSON object`);
  }
  if ((scene.lineId === null) === (scene.seconds === null)) {
    issues.push(`- scenes.${index}: give either lineId or seconds`);
  }
  const { kind } = scene.background;
  return {
    id: scene.id,
    piece: scene.piece,
    params: (params ?? {}) as Record<string, unknown>,
    timing:
      scene.lineId !== null
        ? { kind: 'line' as const, lineId: scene.lineId }
        : { kind: 'seconds' as const, seconds: scene.seconds ?? 0 },
    camera: scene.camera,
    light: scene.light,
    background:
      kind === 'gradient'
        ? { kind, angle: scene.background.angle ?? 160 }
        : kind === 'particles'
          ? { kind, density: scene.background.density ?? ('medium' as const) }
          : { kind },
    ...(scene.transitionOut ? { transitionOut: scene.transitionOut } : {}),
  };
}

/** The director's answer as a plan: brand, voice, language and music come from the line */
export function toPlanInput(
  output: DirectorOutput,
  script: Script,
  frame: PlanFrame,
): { plan: PlanInput; issues: string[] } {
  const issues: string[] = [];
  const scenes = output.scenes.map((scene, index) => sceneToPlan(scene, index, issues));
  const plan: PlanInput = {
    version: 1,
    brand: frame.brand,
    voice: {
      provider: frame.voice.provider,
      voiceId: frame.voice.voiceId,
      language: frame.language,
      lines: script.lines.map(({ id, text }) => ({ id, text })),
    },
    ...(frame.musicTrack ? { music: { track: frame.musicTrack } } : {}),
    captions: { enabled: true, position: output.captionsPosition },
    scenes,
  };
  return { plan, issues };
}

export type DirectionCheck = { ok: true; plan: Plan } | { ok: false; issues: string[] };

/**
 * Everything that can be checked before paying for the voice: the plan validates against the
 * piece catalog, every photo is one of those given, and the plan resolves with the fake voice's
 * timings (a line too long for its piece is caught here).
 */
export function checkDirection(
  output: DirectorOutput,
  script: Script,
  frame: PlanFrame,
): DirectionCheck {
  const { plan: input, issues } = toPlanInput(output, script, frame);
  if (issues.length > 0) return { ok: false, issues };
  const validated = validatePlan(input, pieceCatalog);
  if (!validated.ok) return { ok: false, issues: formatIssues(validated.issues).split('\n') };
  const plan = validated.value;
  const allowed = new Set([...frame.images, frame.brand.logo, frame.musicTrack]);
  const strangers = collectAssetPaths(plan, pieceCatalog).filter((asset) => !allowed.has(asset));
  if (strangers.length > 0) {
    return {
      ok: false,
      issues: strangers.map(
        (asset) => `- (images): "${asset}" is not one of the photos you may use`,
      ),
    };
  }
  const tracks = plan.voice.lines.map((line) => ({
    lineId: line.id,
    src: '',
    ...fakeWords(line.text),
  }));
  const resolved = resolvePlan(plan, tracks, limitsFromCatalog(pieceCatalog));
  if (!resolved.ok) return { ok: false, issues: formatIssues(resolved.issues).split('\n') };
  return { ok: true, plan };
}

export interface DirectionAttempt {
  issues: string[];
}

export type DirectionOutcome =
  | { ok: true; plan: Plan; attempts: DirectionAttempt[] }
  | { ok: false; issues: string[]; attempts: DirectionAttempt[] };

/** Asks the director, sends the issues back up to `maxRetries` times, records every attempt */
export async function directWithRetries(
  ask: (previousIssues: string[]) => Promise<DirectorOutput>,
  check: (output: DirectorOutput) => DirectionCheck,
  maxRetries = MAX_DIRECTION_RETRIES,
): Promise<DirectionOutcome> {
  const attempts: DirectionAttempt[] = [];
  let issues: string[] = [];
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const result = check(await ask(issues));
    attempts.push({ issues: result.ok ? [] : result.issues });
    if (result.ok) return { ok: true, plan: result.plan, attempts };
    issues = result.issues;
  }
  return { ok: false, issues, attempts };
}

function titleLines(text: string): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/)) {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= 28)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(clip(word, 28));
  }
  return lines.slice(0, 3);
}

/** A valid plan for the script with the library's pieces and the photos given */
export function fakeDirection(facts: DirectFacts): DirectorOutput {
  const { material, script, frame } = facts;
  const image = frame.images[0];
  const subject = clip(subjectOf(material), 40);
  const transitions = ['whip', 'fade', 'slide', 'zoom-punch'] as const;
  const lines = script.lines;
  const scenes = lines.map((line, index) => {
    const last = index === lines.length - 1;
    let piece: string;
    let params: Record<string, unknown>;
    if (index === 0) {
      piece = 'hook-question';
      params = { question: clip(line.text, 80) };
    } else if (last) {
      piece = 'cta-end';
      params = { cta: clip(facts.idea.cta, 40) };
    } else if (material.kind === 'product' && image && line.id === 'hero') {
      piece = 'product-hero';
      params = { image, name: subject };
    } else if (material.kind === 'product' && image && line.id === 'price') {
      piece = 'product-price';
      params = {
        image,
        price: material.priceCents,
        ...(material.oldPriceCents ? { oldPrice: material.oldPriceCents } : {}),
        currency: material.currency,
        locale: /^[a-z]{2}-[A-Z]{2}$/.test(frame.language) ? frame.language : 'pt-BR',
      };
    } else if (image && line.id === 'detail') {
      piece = 'product-loupe';
      params = { image, focus: { x: 0.5, y: 0.4 }, label: clip(subject, 40) };
    } else {
      piece = 'kinetic-title';
      params = { lines: titleLines(line.text) };
    }
    return {
      id: line.id,
      piece,
      paramsJson: JSON.stringify(params),
      lineId: line.id,
      seconds: null,
      camera: {
        move: index % 2 === 0 ? ('push-in' as const) : ('static' as const),
        intensity: 'subtle' as const,
      },
      light: { sweep: piece.startsWith('product'), vignette: 0.35 },
      background: { kind: 'gradient' as const, angle: 160, density: null },
      transitionOut: last
        ? null
        : {
            kind: transitions[index % transitions.length]!,
            seconds: 0.4,
            direction: 'left' as const,
          },
    };
  });
  return { scenes, captionsPosition: 'lower', notes: 'Fake direction: one scene per voice line.' };
}
