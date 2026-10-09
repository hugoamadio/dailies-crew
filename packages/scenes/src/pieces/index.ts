import type React from 'react';
import { CtaEnd } from './cta-end/Component';
import { HookBurst } from './hook-burst/Component';
import { HookQuestion } from './hook-question/Component';
import { ProductHero } from './product-hero/Component';
import { ProductLoupe } from './product-loupe/Component';
import { ProductPrice } from './product-price/Component';
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
  'product-hero': asPiece(ProductHero),
  'product-price': asPiece(ProductPrice),
  'product-loupe': asPiece(ProductLoupe),
  'cta-end': asPiece(CtaEnd),
};
