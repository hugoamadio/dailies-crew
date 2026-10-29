import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  approveVideo,
  costsReport,
  createLine,
  createProduct,
  getSettings,
  listLines,
  listProducts,
  listRules,
  listVideos,
  rejectVideo,
  requeueBudgetVideos,
  resumeStudio,
  retryVideo,
  runLineTick,
  setLineActive,
  setProductActive,
  setRuleActive,
  SOCIAL_NETWORKS,
  type SocialPosts,
  StudioError,
  studioStatus,
  syncSchedules,
  updateLine,
  updateSettings,
  videoDetails,
} from '@dailies-crew/studio';
import type { VideoStatus } from '@dailies-crew/db';
import type { Runtime } from './runtime';

export const USAGE = `Usage: npm run crew -- <command> [options]

Lines
  line:add --file <line.json> [--logo <image>]       create a production line
  line:update <lineId> --file <changes.json> [--logo <image>]
  line:list
  line:pause <lineId>  |  line:resume <lineId>
  rules --line <lineId>                               the line's learned rules
  rule:off <ruleId>  |  rule:on <ruleId>              stop or use again a learned rule
Products
  product:add --file <product.json> --image <file> [--image <file>...]
  product:list
  product:off <productId>  |  product:on <productId>
Videos
  run-now --line <lineId> [--count <n>]               make videos now, not at the line's hour
  status                                              lines, spending and videos
  videos [--status <status>] [--line <lineId>]        the latest videos
  show <videoId>                                      everything about a video
  approve <videoId>
  reject <videoId> --reason "<text>" --mode redo|learn [--stage script|direction|produce]
  retry <videoId>                                     try a failed video again
  resume [--line <lineId>]                            after fixing the key, the credit or a cap
Money and settings
  costs [--month YYYY-MM]
  settings                                            models, prices, caps and key status
  settings:set --file <settings.json>                 change some of them`;

export interface CliIo {
  out(line: string): void;
  err(line: string): void;
}

type Options = {
  file?: string;
  logo?: string;
  image?: string[];
  line?: string;
  count?: string;
  status?: string;
  reason?: string;
  mode?: string;
  stage?: string;
  month?: string;
  help?: boolean;
};

interface Input {
  ids: string[];
  options: Options;
  env: Record<string, string | undefined>;
}

interface CommandSpec {
  /** Ids expected after the command name */
  ids: number;
  required?: (keyof Options)[];
  /** Needs pg-boss: it queues jobs or changes the line schedules */
  queue?: boolean;
  run(runtime: Runtime, input: Input, io: CliIo): Promise<void>;
}

const usd = (value: number) => `${value.toFixed(4)} USD`;

async function readJson(file: string): Promise<unknown> {
  let text: string;
  try {
    text = await fs.readFile(path.resolve(file), 'utf8');
  } catch {
    throw new StudioError(`File not found: ${file}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new StudioError(
      `${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function sync(runtime: Runtime, io: CliIo): Promise<void> {
  if (!runtime.boss) return;
  const { scheduled } = await syncSchedules(runtime.boss, runtime.db);
  io.out(`Schedules updated: ${scheduled.length} active lines.`);
}

/** Like sync, for a command whose change is already saved: a failed sync must not look like a failed save */
async function syncAfterSave(runtime: Runtime, io: CliIo, saved: string): Promise<void> {
  try {
    await sync(runtime, io);
  } catch (error) {
    throw new StudioError(
      `${saved} was saved, but the schedules could not be updated (${error instanceof Error ? error.message : String(error)}); they sync at the next worker start or the next line change`,
    );
  }
}

const VIDEO_STATUSES = [
  'queued',
  'running',
  'needs_you',
  'ready_for_review',
  'approved',
  'rejected',
  'failed',
  'paused_budget',
];

const COMMANDS: Record<string, CommandSpec> = {
  'line:add': {
    ids: 0,
    required: ['file'],
    queue: true,
    run: async (runtime, { options }, io) => {
      const line = await createLine(runtime.ctx, await readJson(options.file!), {
        logoFile: options.logo ? path.resolve(options.logo) : undefined,
      });
      io.out(
        `Line created: ${line.id} "${line.name}" (${line.kind}, ${line.perDay} per day at ${line.hour}h)`,
      );
      await syncAfterSave(runtime, io, `Line ${line.id}`);
    },
  },
  'line:update': {
    ids: 1,
    required: ['file'],
    queue: true,
    run: async (runtime, { ids, options }, io) => {
      const line = await updateLine(runtime.ctx, ids[0]!, await readJson(options.file!), {
        logoFile: options.logo ? path.resolve(options.logo) : undefined,
      });
      io.out(`Line updated: ${line.id} "${line.name}"`);
      await syncAfterSave(runtime, io, `Line ${line.id}`);
    },
  },
  'line:list': {
    ids: 0,
    run: async (runtime, _input, io) => {
      const lines = await listLines(runtime.db);
      if (lines.length === 0) io.out('No lines yet: npm run crew -- line:add --file <line.json>');
      for (const line of lines) {
        const notes = [
          line.pausedReason ? `paused: ${line.pausedReason}` : '',
          line.warning ? `warning: ${line.warning}` : '',
        ].filter(Boolean);
        io.out(
          `${line.id}  ${line.active ? 'on ' : 'off'}  ${line.name} (${line.kind}, ${line.perDay}/day at ${line.hour}h, cap ${line.monthlyCapUsd} USD)${notes.length ? `  ${notes.join('; ')}` : ''}`,
        );
      }
    },
  },
  'line:pause': {
    ids: 1,
    queue: true,
    run: async (runtime, { ids }, io) => {
      const line = await setLineActive(runtime.db, ids[0]!, false);
      io.out(`Line paused: "${line.name}"`);
      await sync(runtime, io);
    },
  },
  'line:resume': {
    ids: 1,
    queue: true,
    run: async (runtime, { ids }, io) => {
      const line = await setLineActive(runtime.db, ids[0]!, true);
      io.out(`Line on: "${line.name}" (every day at ${line.hour}h)`);
      const queued = await requeueBudgetVideos(runtime.ctx, line.id);
      if (queued > 0) io.out(`${queued} videos that waited for the cap were queued again.`);
      await sync(runtime, io);
    },
  },
  rules: {
    ids: 0,
    required: ['line'],
    run: async (runtime, { options }, io) => {
      const rules = await listRules(runtime.db, options.line!);
      if (rules.length === 0) io.out('No learned rules yet.');
      for (const rule of rules) io.out(`${rule.id}  ${rule.active ? 'on ' : 'off'}  ${rule.text}`);
    },
  },
  'rule:off': {
    ids: 1,
    run: async (runtime, { ids }, io) => {
      const rule = await setRuleActive(runtime.db, ids[0]!, false);
      io.out(`Rule off: ${rule.text}`);
    },
  },
  'rule:on': {
    ids: 1,
    run: async (runtime, { ids }, io) => {
      const rule = await setRuleActive(runtime.db, ids[0]!, true);
      io.out(`Rule on: ${rule.text}`);
    },
  },
  'product:add': {
    ids: 0,
    required: ['file', 'image'],
    run: async (runtime, { options }, io) => {
      const images = (options.image ?? []).map((file) => path.resolve(file));
      const product = await createProduct(runtime.ctx, await readJson(options.file!), images);
      io.out(`Product created: ${product.id} "${product.name}" (${product.images.length} images)`);
    },
  },
  'product:list': {
    ids: 0,
    run: async (runtime, _input, io) => {
      const products = await listProducts(runtime.db);
      if (products.length === 0) io.out('No products yet: npm run crew -- product:add ...');
      for (const product of products) {
        io.out(
          `${product.id}  ${product.active ? 'on ' : 'off'}  ${product.name}  ${(product.priceCents / 100).toFixed(2)} ${product.currency}  ${product.images.length} images${product.category ? `  [${product.category}]` : ''}`,
        );
      }
    },
  },
  'product:off': {
    ids: 1,
    run: async (runtime, { ids }, io) => {
      io.out(`Product off: "${(await setProductActive(runtime.db, ids[0]!, false)).name}"`);
    },
  },
  'product:on': {
    ids: 1,
    run: async (runtime, { ids }, io) => {
      io.out(`Product on: "${(await setProductActive(runtime.db, ids[0]!, true)).name}"`);
    },
  },
  'run-now': {
    ids: 0,
    required: ['line'],
    queue: true,
    run: async (runtime, { options }, io) => {
      const count = options.count === undefined ? undefined : Number(options.count);
      if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > 10)) {
        throw new StudioError('--count must be a whole number from 1 to 10');
      }
      const result = await runLineTick(runtime.ctx, options.line!, { count });
      if (result.created.length === 0) io.out(`Nothing made: ${result.skipped}`);
      else {
        io.out(`${result.created.length} videos queued (the worker makes them: npm run worker):`);
        for (const id of result.created) io.out(`  ${id}`);
      }
    },
  },
  status: {
    ids: 0,
    run: async (runtime, _input, io) => {
      const status = await studioStatus(runtime.db, runtime.ctx.now());
      if (status.warning)
        io.out(`STOPPED: ${status.warning}\n  fix it, then: npm run crew -- resume`);
      io.out(
        `This month (${status.month.year}-${String(status.month.month).padStart(2, '0')}): ${usd(status.monthSpend)} of ${status.globalCapUsd} USD`,
      );
      for (const line of status.lines) {
        const state = line.active
          ? `every day at ${line.hour}h`
          : `paused${line.pausedReason ? `: ${line.pausedReason}` : ''}`;
        io.out(
          `- ${line.name}: ${usd(line.monthSpend)} of ${line.monthlyCapUsd} USD, ${state}${line.warning ? `; warning: ${line.warning}` : ''}`,
        );
      }
      const counts = Object.entries(status.videos).map(([name, count]) => `${name} ${count}`);
      io.out(`Videos: ${counts.length ? counts.join(', ') : 'none yet'}`);
    },
  },
  videos: {
    ids: 0,
    run: async (runtime, { options }, io) => {
      if (options.status && !VIDEO_STATUSES.includes(options.status)) {
        throw new StudioError(`--status must be one of ${VIDEO_STATUSES.join(', ')}`);
      }
      const videos = await listVideos(runtime.db, {
        status: options.status as VideoStatus | undefined,
        lineId: options.line,
      });
      if (videos.length === 0) io.out('No videos.');
      for (const video of videos) {
        io.out(
          `${video.id}  ${video.status}  ${video.stage} (round ${video.round})  ${usd(video.costUsd)}  ${video.line.name}${video.product ? ` / ${video.product.name}` : ''}`,
        );
      }
    },
  },
  show: {
    ids: 1,
    run: async (runtime, { ids }, io) => {
      const video = await videoDetails(runtime.db, ids[0]!);
      const dataDir = runtime.ctx.dataDir;
      io.out(`Video ${video.id}: ${video.status}, stage ${video.stage}, round ${video.round}`);
      io.out(`Line: ${video.line.name}${video.product ? `; product: ${video.product.name}` : ''}`);
      io.out(
        `Cost: ${usd(video.costUsd)}${video.durationSeconds ? `; ${video.durationSeconds} s` : ''}`,
      );
      if (video.videoFile) io.out(`File: ${path.join(dataDir, video.videoFile)}`);
      if (video.failureReason) io.out(`Failure (${video.failureKind}): ${video.failureReason}`);
      for (const problem of video.problems) io.out(`Problem: ${problem}`);
      const chosen = video.ideas.find((idea) => idea.status === 'chosen' || idea.status === 'used');
      if (chosen) io.out(`Idea: ${chosen.title} (score ${chosen.total})`);
      io.out('Stages:');
      for (const run of video.stageRuns) {
        io.out(
          `  ${run.stage} round ${run.round} attempt ${run.attempt}: ${run.status}, ${usd(run.costUsd)}${run.error ? ` (${run.error})` : ''}`,
        );
      }
      for (const decision of video.decisions) {
        io.out(
          `Decision: ${decision.kind}${decision.mode ? ` (${decision.mode}${decision.targetStage ? ` → ${decision.targetStage}` : ''})` : ''}${decision.reason ? `: ${decision.reason}` : ''}`,
        );
      }
      const posts = video.social as SocialPosts | null;
      if (posts) {
        for (const network of SOCIAL_NETWORKS) {
          const post = posts[network];
          io.out(`${network}: ${post.title} ${post.hashtags.join(' ')}`);
          io.out(`  ${post.description}`);
        }
      }
    },
  },
  approve: {
    ids: 1,
    run: async (runtime, { ids }, io) => {
      const video = await approveVideo(runtime.ctx, ids[0]!);
      io.out(`Approved, ready to post: ${path.join(runtime.ctx.dataDir, video.videoFile!)}`);
      io.out(`Post texts: npm run crew -- show ${video.id}`);
    },
  },
  reject: {
    ids: 1,
    required: ['reason', 'mode'],
    queue: true,
    run: async (runtime, { ids, options }, io) => {
      const result = await rejectVideo(runtime.ctx, ids[0]!, {
        reason: options.reason,
        mode: options.mode,
        ...(options.stage ? { targetStage: options.stage } : {}),
      });
      if (result.rule) io.out(`Rejected. New rule for the line: ${result.rule}`);
      else
        io.out(`Sent back to ${result.stage} (round ${result.video.round}); the worker redoes it.`);
    },
  },
  retry: {
    ids: 1,
    queue: true,
    run: async (runtime, { ids }, io) => {
      const video = await retryVideo(runtime.ctx, ids[0]!);
      io.out(`Queued again at ${video.stage}.`);
    },
  },
  resume: {
    ids: 0,
    queue: true,
    run: async (runtime, { options }, io) => {
      const result = await resumeStudio(runtime.ctx, { lineId: options.line });
      io.out(`Resumed: ${result.lines} lines on, ${result.videos} videos queued again.`);
      await sync(runtime, io);
    },
  },
  costs: {
    ids: 0,
    run: async (runtime, { options }, io) => {
      const report = await costsReport(runtime.db, runtime.ctx.now(), options.month);
      io.out(
        `${report.month}: ${usd(report.totalUsd)} for ${report.videos} videos (${usd(report.perVideoUsd)} per video)`,
      );
      for (const line of report.lines) io.out(`  line ${line.line}: ${usd(line.usd)}`);
      for (const role of report.roles) io.out(`  ${role.role}: ${usd(role.usd)}`);
    },
  },
  settings: {
    ids: 0,
    run: async (runtime, { env }, io) => {
      const { warning, warningAt, ...settings } = await getSettings(runtime.db);
      io.out(JSON.stringify(settings, null, 2));
      io.out(
        `ANTHROPIC_API_KEY: ${env.ANTHROPIC_API_KEY ? 'configured' : 'missing'}${env.DAILIES_FAKE_AI === '1' ? ' (fake AI on)' : ''}`,
      );
      io.out(`ELEVENLABS_API_KEY: ${env.ELEVENLABS_API_KEY ? 'configured' : 'missing'}`);
      if (warning) io.out(`STOPPED since ${warningAt?.toISOString()}: ${warning}`);
    },
  },
  'settings:set': {
    ids: 0,
    required: ['file'],
    queue: true,
    run: async (runtime, { options }, io) => {
      await updateSettings(runtime.db, await readJson(options.file!));
      io.out('Settings saved.');
      // a new time zone moves the daily runs; no worker restart needed
      await sync(runtime, io);
    },
  },
};

/**
 * Parses and checks the command line before opening anything, then runs the command against
 * the runtime `open` gives (database, and pg-boss when the command needs the queue).
 */
export async function runCli(
  argv: string[],
  io: CliIo,
  env: Record<string, string | undefined>,
  open: (needs: { queue: boolean }) => Promise<Runtime>,
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        file: { type: 'string' },
        logo: { type: 'string' },
        image: { type: 'string', multiple: true },
        line: { type: 'string' },
        count: { type: 'string' },
        status: { type: 'string' },
        reason: { type: 'string' },
        mode: { type: 'string' },
        stage: { type: 'string' },
        month: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error));
    io.err(USAGE);
    return 1;
  }
  const [name, ...ids] = parsed.positionals;
  const options = parsed.values as Options;
  if (options.help || name === 'help') {
    io.out(USAGE);
    return 0;
  }
  const command = name ? COMMANDS[name] : undefined;
  if (!command) {
    io.err(name ? `Unknown command "${name}"` : 'Which command?');
    io.err(USAGE);
    return 1;
  }
  const missing = (command.required ?? []).filter((option) => options[option] === undefined);
  if (ids.length !== command.ids || missing.length > 0) {
    io.err(
      [
        ids.length !== command.ids
          ? `"${name}" takes ${command.ids === 1 ? 'one id' : 'no id'}`
          : '',
        missing.length
          ? `"${name}" needs ${missing.map((option) => `--${option}`).join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('; '),
    );
    io.err(USAGE);
    return 1;
  }
  let runtime: Runtime | undefined;
  let code = 1;
  try {
    runtime = await open({ queue: command.queue ?? false });
    await command.run(runtime, { ids, options, env }, io);
    code = 0;
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error));
  }
  try {
    await runtime?.close();
  } catch (error) {
    io.err(`Could not close cleanly: ${error instanceof Error ? error.message : String(error)}`);
    code = 1;
  }
  return code;
}
