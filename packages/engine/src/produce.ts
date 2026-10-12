import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  collectAssetPaths,
  limitsFromCatalog,
  PlanError,
  type ResolvedPlan,
  resolvePlan,
  validatePlan,
} from '@dailies-crew/plan';
import { pieceCatalog } from '@dailies-crew/scenes/specs';
import { EngineError } from './errors';
import { type ReviewFramesOptions, renderVideo } from './render';
import { stageAssets } from './stage';
import { synthesizeVoice } from './synthesize';
import { createVoiceProvider, type VoiceProvider } from './voice';

export { EngineError } from './errors';
export { type RenderResult, type ReviewFramesOptions, renderVideo } from './render';
export { stageAssets } from './stage';
export { type SynthesisOutcome, synthesizeVoice } from './synthesize';

export type ProduceStage = 'validate' | 'assets' | 'voice' | 'resolve' | 'render' | 'done';

export interface ProduceOptions {
  /** A direction plan JSON file; or pass the plan itself as `plan` (exactly one of the two) */
  planFile?: string;
  plan?: unknown;
  /** Folder the plan's asset paths are relative to */
  assetsDir: string;
  /** Default: <workDir>/video.mp4 */
  outFile?: string;
  /**
   * Default: data/jobs/<timestamp>-<id> under the current directory. Holds public/ (staged assets
   * and voice), bundle/ (the Remotion bundle, removed after the render) and video.mp4
   */
  workDir?: string;
  /** Default: the plan's own provider, built from env */
  voice?: VoiceProvider;
  env?: Record<string, string | undefined>;
  onStage?: (stage: ProduceStage, detail?: string) => void;
  onRenderProgress?: (progress: number) => void;
  /** Also render still frames for the reviewers (into <workDir>/frames) */
  reviewFrames?: ReviewFramesOptions;
  /** Aborting it stops the job before the next step, and cancels a render in progress */
  signal?: AbortSignal;
}

export interface ProduceResult {
  outFile: string;
  workDir: string;
  durationSeconds: number;
  /** Voice characters synthesized now, for the cost of the video */
  voiceCharacters: number;
  /** Voice characters reused from <workDir>/voice-cache.json: already paid */
  cachedVoiceCharacters: number;
  resolved: ResolvedPlan;
  /** The review frames in time order; empty without reviewFrames */
  frameFiles: string[];
}

async function readPlanFile(planFile: string): Promise<unknown> {
  let text: string;
  try {
    text = await fs.readFile(planFile, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new EngineError(`plan file not found: ${planFile}`);
    }
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new EngineError(
      `${planFile} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Direction plan → MP4: validate, stage the assets, speak the lines, resolve, render */
export async function produceVideo(options: ProduceOptions): Promise<ProduceResult> {
  if ((options.planFile === undefined) === (options.plan === undefined)) {
    throw new EngineError('pass either planFile or plan');
  }
  const raw = options.planFile !== undefined ? await readPlanFile(options.planFile) : options.plan;

  options.onStage?.('validate');
  const validated = validatePlan(raw, pieceCatalog);
  if (!validated.ok) throw new PlanError(validated.issues);
  const plan = validated.value;

  const workDir =
    options.workDir ??
    path.join(
      process.cwd(),
      'data',
      'jobs',
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`,
    );
  const publicDir = path.join(workDir, 'public');
  await fs.mkdir(publicDir, { recursive: true });

  options.onStage?.('assets');
  await stageAssets(collectAssetPaths(plan, pieceCatalog), options.assetsDir, publicDir);

  const provider =
    options.voice ?? createVoiceProvider(plan.voice.provider, options.env ?? process.env);
  options.signal?.throwIfAborted();
  options.onStage?.('voice', provider.name);
  const { tracks, characters, cachedCharacters } = await synthesizeVoice(
    plan,
    provider,
    publicDir,
    { cacheFile: path.join(workDir, 'voice-cache.json'), signal: options.signal },
  );

  options.onStage?.('resolve');
  const resolved = resolvePlan(plan, tracks, limitsFromCatalog(pieceCatalog));
  if (!resolved.ok) throw new PlanError(resolved.issues);

  const outFile = options.outFile ?? path.join(workDir, 'video.mp4');
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  options.signal?.throwIfAborted();
  options.onStage?.('render');
  const { frameFiles } = await renderVideo({
    resolved: resolved.value,
    publicDir,
    outFile,
    onProgress: options.onRenderProgress,
    reviewFrames: options.reviewFrames,
    signal: options.signal,
  });

  options.onStage?.('done', outFile);
  return {
    outFile,
    workDir,
    durationSeconds: resolved.value.durationInFrames / resolved.value.fps,
    voiceCharacters: characters,
    cachedVoiceCharacters: cachedCharacters,
    resolved: resolved.value,
    frameFiles,
  };
}
