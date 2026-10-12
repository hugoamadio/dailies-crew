import type { Db, Stage, Video } from '@dailies-crew/db';
import { type Plan, PlanSchema } from '@dailies-crew/plan';
import { parseInput, StudioError } from '../errors';
import type { Instruction } from '../crew/context';
import { type IdeaDraft, IdeaSchema } from '../crew/creator';
import { type Briefing, BriefingSchema } from '../crew/preparer';
import { type Script, ScriptSchema } from '../crew/scriptwriter';

function need<T>(value: T | null | undefined, what: string, video: Video): T {
  if (value === null || value === undefined) {
    throw new StudioError(`Video ${video.id} has no ${what} yet (stage ${video.stage})`);
  }
  return value;
}

export function briefingOf(video: Video): Briefing {
  return parseInput(
    BriefingSchema,
    need(video.briefing, 'briefing', video),
    `briefing of video ${video.id}`,
  );
}

export function scriptOf(video: Video): Script {
  return parseInput(
    ScriptSchema,
    need(video.script, 'script', video),
    `script of video ${video.id}`,
  );
}

export function planOf(video: Video): Plan {
  return parseInput(PlanSchema, need(video.plan, 'plan', video), `plan of video ${video.id}`);
}

/** The change requests of the current round for one stage */
export function instructionsFor(video: Video, stage: Stage): string[] {
  return (video.instructions as unknown as Instruction[])
    .filter((item) => item.stage === stage)
    .map((item) => (item.source === 'hugo' ? `(Hugo) ${item.instruction}` : item.instruction));
}

/** The idea the committee picked for the video (a new one, or one taken from the bank) */
export async function chosenIdeaOf(db: Db, video: Video): Promise<IdeaDraft> {
  const idea = await db.idea.findFirst({
    where: { videoId: video.id, status: { in: ['chosen', 'used'] } },
  });
  const { title, hook, angle, structure, cta } = need(idea, 'chosen idea', video);
  return parseInput(
    IdeaSchema,
    { title, hook, angle, structure, cta },
    `chosen idea of video ${video.id}`,
  );
}

/** What the last finished run of a stage produced, in any round */
export async function latestOutput<T>(db: Db, videoId: string, stage: Stage): Promise<T | null> {
  const run = await db.stageRun.findFirst({
    where: { videoId, stage, status: 'done' },
    orderBy: [{ round: 'desc' }, { attempt: 'desc' }],
  });
  return run ? ((run.output as { data: T }).data ?? null) : null;
}
