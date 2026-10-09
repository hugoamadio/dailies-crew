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
import { renderVideo } from './render';
import { stageAssets } from './stage';
import { synthesizeVoice } from './synthesize';
import { createVoiceProvider, type VoiceProvider } from './voice';

export { EngineError } from './errors';
export { renderVideo } from './render';
export { stageAssets } from './stage';
export { synthesizeVoice } from './synthesize';

export type ProduceStage = 'validate' | 'assets' | 'voice' | 'resolve' | 'render' | 'done';

export interface ProduceOptions {
  planFile: string;
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
}

export interface ProduceResult {
  outFile: string;
  workDir: string;
  durationSeconds: number;
  /** Billed voice characters, for the cost of the video */
  voiceCharacters: number;
  resolved: ResolvedPlan;
}

/** Direction plan file → MP4: validate, stage the assets, speak the lines, resolve, render */
export async function produceVideo(options: ProduceOptions): Promise<ProduceResult> {
  let text: string;
  try {
    text = await fs.readFile(options.planFile, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new EngineError(`plan file not found: ${options.planFile}`);
    }
    throw error;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new EngineError(
      `${options.planFile} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

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
  options.onStage?.('voice', provider.name);
  const { tracks, characters } = await synthesizeVoice(plan, provider, publicDir);

  options.onStage?.('resolve');
  const resolved = resolvePlan(plan, tracks, limitsFromCatalog(pieceCatalog));
  if (!resolved.ok) throw new PlanError(resolved.issues);

  const outFile = options.outFile ?? path.join(workDir, 'video.mp4');
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  options.onStage?.('render');
  await renderVideo({
    resolved: resolved.value,
    publicDir,
    outFile,
    onProgress: options.onRenderProgress,
  });

  options.onStage?.('done', outFile);
  return {
    outFile,
    workDir,
    durationSeconds: resolved.value.durationInFrames / resolved.value.fps,
    voiceCharacters: characters,
    resolved: resolved.value,
  };
}
