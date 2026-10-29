// The studio: everything the worker, the crew CLI and (in plan 1C) the panel call.
import { createFakeLlm } from './crew/fake';
import { createLlm } from './llm';
import type { LlmClient } from './llm/types';

export * from './assets';
export * from './costs/math';
export * from './costs/month';
export * from './costs/service';
export * from './crew/context';
export * from './crew/creator';
export * from './crew/director';
export * from './crew/fake';
export * from './crew/judge';
export * from './crew/preparer';
export * from './crew/reviewer';
export * from './crew/router';
export * from './crew/scriptwriter';
export * from './crew/social';
export * from './decisions/output';
export * from './decisions/service';
export * from './errors';
export * from './lines/schema';
export * from './lines/service';
export * from './llm';
export * from './material';
export * from './paths';
export * from './pipeline/context';
export * from './pipeline/failure';
export * from './pipeline/handler';
export { STAGE_HANDLERS } from './pipeline/handlers';
export * from './pipeline/outcome';
export * from './pipeline/runner';
export * from './pipeline/stages';
export * from './products/schema';
export * from './products/service';
export * from './queue/boss';
export * from './queue/scheduler';
export * from './queue/sweep';
export * from './queue/worker-state';
export * from './roles';
export * from './settings/defaults';
export * from './settings/schema';
export * from './settings/service';
export * from './videos/service';
export * from './videos/tick';

/** The fake AI with DAILIES_FAKE_AI=1, Claude otherwise (ANTHROPIC_API_KEY required) */
export function createStudioLlm(env: Record<string, string | undefined>): LlmClient {
  return createLlm(env, createFakeLlm);
}
