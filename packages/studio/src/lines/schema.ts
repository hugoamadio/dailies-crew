import { AudioPath, BrandSchema, ImagePath } from '@dailies-crew/plan';
import { z } from 'zod';

export const LINE_KINDS = ['product', 'brand', 'topic'] as const;

/** Which products a product line shows: all of them, one category, or a chosen few */
export const ProductMaterialSchema = z.discriminatedUnion('select', [
  z.strictObject({ select: z.literal('all') }),
  z.strictObject({ select: z.literal('category'), category: z.string().trim().min(1).max(60) }),
  z.strictObject({ select: z.literal('chosen'), productIds: z.array(z.uuid()).min(1).max(200) }),
]);

/** What a brand line talks about: a text about the brand, photos (in data/assets) and links */
export const BrandMaterialSchema = z.strictObject({
  about: z.string().trim().min(20).max(3000),
  images: z.array(ImagePath).max(10).default([]),
  links: z.array(z.url()).max(10).default([]),
});

/** What a free-topic line talks about, and what it must stay away from */
export const TopicMaterialSchema = z.strictObject({
  subject: z.string().trim().min(5).max(500),
  avoid: z.string().trim().max(500).default(''),
});

const lineShape = {
  name: z.string().trim().min(1).max(80),
  perDay: z.number().int().min(1).max(10),
  /** 0-23 in the settings' time zone; the settings' default hour when missing */
  hour: z.number().int().min(0).max(23).optional(),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'must look like "pt-BR" or "en"'),
  objective: z.string().trim().min(3).max(300),
  audience: z.string().trim().min(3).max(300),
  tone: z.string().trim().min(3).max(120),
  /** The plan's brand: colors, fonts, personality and a logo path relative to data/assets */
  brand: BrandSchema,
  voice: z.strictObject({
    provider: z.enum(['elevenlabs', 'fake']),
    voiceId: z.string().trim().min(1).max(100),
  }),
  /** Relative to data/assets, e.g. "music/calm.mp3" */
  musicTrack: AudioPath.nullable().default(null),
  monthlyCapUsd: z.number().min(0).max(10_000),
  active: z.boolean().default(true),
};

export const LineInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...lineShape, kind: z.literal('product'), material: ProductMaterialSchema }),
  z.strictObject({ ...lineShape, kind: z.literal('brand'), material: BrandMaterialSchema }),
  z.strictObject({ ...lineShape, kind: z.literal('topic'), material: TopicMaterialSchema }),
]);

/** Every field but kind may change; the material is checked against the line's kind */
export const LinePatchSchema = z.strictObject({
  name: lineShape.name.optional(),
  perDay: lineShape.perDay.optional(),
  hour: z.number().int().min(0).max(23).optional(),
  language: lineShape.language.optional(),
  objective: lineShape.objective.optional(),
  audience: lineShape.audience.optional(),
  tone: lineShape.tone.optional(),
  brand: BrandSchema.optional(),
  voice: lineShape.voice.optional(),
  musicTrack: AudioPath.nullable().optional(),
  monthlyCapUsd: lineShape.monthlyCapUsd.optional(),
  material: z.unknown().optional(),
});

export type LineInput = z.input<typeof LineInputSchema>;
export type LineData = z.output<typeof LineInputSchema>;
export type ProductMaterial = z.output<typeof ProductMaterialSchema>;
export type BrandMaterial = z.output<typeof BrandMaterialSchema>;
export type TopicMaterial = z.output<typeof TopicMaterialSchema>;

/** A production line as the crews see it */
export type Line = LineData & {
  id: string;
  hour: number;
  pausedReason: string | null;
  warning: string | null;
};
