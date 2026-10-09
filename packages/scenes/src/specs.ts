import { catalogFromSpecs, type PieceSpec } from '@dailies-crew/plan';
import { hookBurstSpec } from './pieces/hook-burst/spec';
import { hookQuestionSpec } from './pieces/hook-question/spec';
import { kineticTitleSpec } from './pieces/kinetic-title/spec';

/** Every piece of the library. No React here: Node code (the engine, the agents) imports this file */
export const pieceSpecs: readonly PieceSpec[] = [hookQuestionSpec, hookBurstSpec, kineticTitleSpec];
export const pieceCatalog = catalogFromSpecs(pieceSpecs);
