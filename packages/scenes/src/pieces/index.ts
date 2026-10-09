import type React from 'react';
import { HookBurst } from './hook-burst/Component';
import { HookQuestion } from './hook-question/Component';
import { KineticTitle } from './kinetic-title/Component';

export type PieceComponent = React.FC<{ params: Record<string, unknown> }>;

/** Params reach the component already validated by the piece's schema (validatePlan) */
function asPiece<P>(component: React.FC<{ params: P }>): PieceComponent {
  return component as unknown as PieceComponent;
}

export const pieceComponents: Record<string, PieceComponent> = {
  'kinetic-title': asPiece(KineticTitle),
  'hook-question': asPiece(HookQuestion),
  'hook-burst': asPiece(HookBurst),
};
