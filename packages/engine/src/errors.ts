/** A problem with the job itself (files, assets, rendering), as opposed to the plan (PlanError) */
export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}
