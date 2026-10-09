import { z } from 'zod';
import { HexColor, ImagePath } from './primitives';

/** Fonts the scenes know how to load (packages/scenes/src/theme/fonts.ts) */
export const FONT_NAMES = [
  'Inter',
  'Montserrat',
  'Poppins',
  'Bebas Neue',
  'Playfair Display',
  'Space Grotesk',
] as const;
export type FontName = (typeof FONT_NAMES)[number];

export const BrandSchema = z.strictObject({
  colors: z.strictObject({
    background: HexColor,
    surface: HexColor,
    text: HexColor,
    primary: HexColor,
    accent: HexColor,
  }),
  headingFont: z.enum(FONT_NAMES),
  bodyFont: z.enum(FONT_NAMES),
  logo: ImagePath.optional(),
  /** Drives how springy every entrance is (packages/scenes/src/theme/motion.ts) */
  personality: z.enum(['calm', 'energetic', 'playful', 'premium']).default('energetic'),
});
export type Brand = z.output<typeof BrandSchema>;
