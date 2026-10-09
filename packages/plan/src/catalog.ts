import type { z } from 'zod';

/** What the plan needs to know about a piece of the scene library ("ficha" in the spec) */
export interface PieceSpec {
  id: string;
  title: string;
  /** Read by the directing agents to pick pieces: what it shows and when it works */
  description: string;
  paramsSchema: z.ZodType<Record<string, unknown>>;
  /** Param keys whose values are asset paths: they are copied next to the video before rendering */
  assetParams: readonly string[];
  minSeconds: number;
  maxSeconds: number;
  /** Valid params, used by the visual tests, the Studio and the agents as a model */
  example: Record<string, unknown>;
}

export type PieceCatalog = ReadonlyMap<string, PieceSpec>;

export function catalogFromSpecs(specs: readonly PieceSpec[]): PieceCatalog {
  const catalog = new Map<string, PieceSpec>();
  for (const spec of specs) {
    if (catalog.has(spec.id)) throw new Error(`Two pieces share the id "${spec.id}"`);
    catalog.set(spec.id, spec);
  }
  return catalog;
}
