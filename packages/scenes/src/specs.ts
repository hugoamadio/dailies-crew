import { catalogFromSpecs, type PieceSpec } from '@dailies-crew/plan';
import { kineticTitleSpec } from './pieces/kinetic-title/spec';

/** Every piece of the library. No React here: Node code (the engine, the agents) imports this file */
export const pieceSpecs: readonly PieceSpec[] = [kineticTitleSpec];
export const pieceCatalog = catalogFromSpecs(pieceSpecs);
