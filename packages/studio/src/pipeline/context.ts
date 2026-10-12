import type { Db, Product, Stage, Tx, Video } from '@dailies-crew/db';
import type { ProduceOptions, ProduceResult } from '@dailies-crew/engine';
import type { VoiceProvider } from '@dailies-crew/engine/voice';
import type { Material, Recipe } from '../crew/context';
import type { Line } from '../lines/schema';
import type { LlmClient, LlmRequest } from '../llm/types';
import type { StudioSettings } from '../settings/schema';

/** Where stage jobs go: pg-boss in the worker, an in-memory list in tests */
export interface JobQueue {
  /** With tx, the job is created inside that database transaction (all or nothing) */
  enqueue(stage: Stage, videoId: string, tx?: Tx): Promise<void>;
}

/** What the services and the stages need from the outside world */
export interface StudioContext {
  db: Db;
  llm: LlmClient;
  /** A voice provider by name; the line picks which */
  voices: (provider: 'elevenlabs' | 'fake') => VoiceProvider;
  queue: JobQueue;
  /** DAILIES_DATA_DIR: assets/ and jobs/ live here */
  dataDir: string;
  now: () => Date;
  log: (message: string) => void;
  /** The engine's produceVideo (tests pass a quick fake) */
  produce: (options: ProduceOptions) => Promise<ProduceResult>;
}

/** What one run of one stage of one video works with */
export interface StageRunContext {
  stage: Stage;
  video: Video;
  line: Line;
  product: Product | null;
  settings: StudioSettings;
  recipe: Recipe;
  material: Material;
  /** The line's active learned rules */
  rules: string[];
  /** Aborted when the job expires or the worker stops */
  signal?: AbortSignal;
  /** Calls a role, records its cost, returns the checked answer */
  call<T>(request: LlmRequest<T>): Promise<T>;
  /** The line's voice provider, recording the cost of every synthesis */
  voice(): VoiceProvider;
}
