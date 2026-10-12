import fs from 'node:fs/promises';
import path from 'node:path';
import type { Db, Stage } from '@dailies-crew/db';
import type { ProduceOptions, ProduceResult } from '@dailies-crew/engine';
import { FakeVoiceProvider } from '@dailies-crew/engine/voice';
import {
  limitsFromCatalog,
  PlanError,
  resolvePlan,
  validatePlan,
  type VoiceTrack,
} from '@dailies-crew/plan';
import { pieceCatalog } from '@dailies-crew/scenes/specs';
import { createFakeLlm } from '../src/crew/fake';
import type { LlmClient } from '../src/llm/types';
import type { JobQueue, StudioContext } from '../src/pipeline/context';
import type { StageHandler } from '../src/pipeline/handler';
import { runStage } from '../src/pipeline/runner';

/** Jobs kept in a list: tests run them one by one with drain() */
export class MemoryQueue implements JobQueue {
  readonly jobs: { stage: Stage; videoId: string }[] = [];

  async enqueue(stage: Stage, videoId: string): Promise<void> {
    this.jobs.push({ stage, videoId });
  }
}

/** The engine without Remotion: real plan checks and voice calls, a dummy video and 4 frames */
export async function fakeProduce(options: ProduceOptions): Promise<ProduceResult> {
  const validated = validatePlan(options.plan, pieceCatalog);
  if (!validated.ok) throw new PlanError(validated.issues);
  const plan = validated.value;
  const workDir = options.workDir!;
  const voice = options.voice!;
  let characters = 0;
  const tracks: VoiceTrack[] = [];
  for (const line of plan.voice.lines) {
    const result = await voice.synthesize({
      text: line.text,
      voiceId: plan.voice.voiceId,
      language: plan.voice.language,
    });
    characters += result.characters;
    tracks.push({
      lineId: line.id,
      src: `voice/${line.id}.wav`,
      words: result.words,
      durationSeconds: result.durationSeconds,
    });
  }
  const resolved = resolvePlan(plan, tracks, limitsFromCatalog(pieceCatalog));
  if (!resolved.ok) throw new PlanError(resolved.issues);
  const outFile = options.outFile ?? path.join(workDir, 'video.mp4');
  await fs.mkdir(path.join(workDir, 'frames'), { recursive: true });
  await fs.writeFile(outFile, 'not really a video');
  const frameFiles: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const file = path.join(workDir, 'frames', `element-${index}.jpeg`);
    await fs.writeFile(file, `frame ${index}`);
    frameFiles.push(file);
  }
  return {
    outFile,
    workDir,
    durationSeconds: resolved.value.durationInFrames / resolved.value.fps,
    voiceCharacters: characters,
    cachedVoiceCharacters: 0,
    resolved: resolved.value,
    frameFiles,
  };
}

export function testContext(
  db: Db,
  dataDir: string,
  overrides: Partial<StudioContext> = {},
): StudioContext & { queue: MemoryQueue; logs: string[] } {
  const logs: string[] = [];
  return {
    db,
    llm: createFakeLlm() as LlmClient,
    voices: () => new FakeVoiceProvider(),
    queue: new MemoryQueue(),
    dataDir,
    now: () => new Date(),
    log: (message) => logs.push(message),
    produce: fakeProduce,
    logs,
    ...overrides,
  } as StudioContext & { queue: MemoryQueue; logs: string[] };
}

/** Runs the queued jobs in order (each one may queue the next) until none is left */
export async function drain(
  ctx: StudioContext & { queue: MemoryQueue },
  handlers: Record<Stage, StageHandler>,
  maxJobs = 50,
): Promise<{ stage: Stage; videoId: string }[]> {
  const ran: { stage: Stage; videoId: string }[] = [];
  while (ctx.queue.jobs.length > 0) {
    if (ran.length >= maxJobs) throw new Error(`more than ${maxJobs} jobs: a loop?`);
    const job = ctx.queue.jobs.shift()!;
    ran.push(job);
    await runStage(ctx, job.stage, { videoId: job.videoId, lastAttempt: true }, handlers);
  }
  return ran;
}
