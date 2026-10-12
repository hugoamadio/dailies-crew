import { z } from 'zod';
import { EFFORTS, ROLE_NAMES } from '../roles';

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const RoleConfigSchema = z.strictObject({
  model: z.string().trim().min(1).max(100),
  effort: z.enum(EFFORTS),
});

/** USD per million tokens */
export const ModelPriceSchema = z.strictObject({
  input: z.number().min(0),
  output: z.number().min(0),
  cacheRead: z.number().min(0),
  cacheWrite: z.number().min(0),
});

export const RolesSchema = z.strictObject({
  preparer: RoleConfigSchema,
  creator: RoleConfigSchema,
  judge: RoleConfigSchema,
  scriptwriter: RoleConfigSchema,
  director: RoleConfigSchema,
  reviewer: RoleConfigSchema,
  social: RoleConfigSchema,
  'rejection-router': RoleConfigSchema,
});

/** USD per 1000 characters */
export const VoicePricesSchema = z.strictObject({
  elevenlabs: z.number().min(0),
  fake: z.number().min(0),
});

export const PricesSchema = z.strictObject({
  models: z.record(z.string(), ModelPriceSchema),
  voicePer1kChars: VoicePricesSchema,
});

export const SettingsSchema = z
  .strictObject({
    roles: RolesSchema,
    prices: PricesSchema,
    globalMonthlyCapUsd: z.number().min(0).max(100_000),
    defaultHour: z.number().int().min(0).max(23),
    timezone: z.string().refine(isTimeZone, 'must be an IANA time zone, e.g. "America/Sao_Paulo"'),
  })
  .superRefine((settings, context) => {
    for (const role of ROLE_NAMES) {
      const { model } = settings.roles[role];
      if (!settings.prices.models[model]) {
        context.addIssue({
          code: 'custom',
          path: ['prices', 'models'],
          message: `model "${model}" (role ${role}) has no price`,
        });
      }
    }
  });

/** What "crew settings:set" and the panel send: every field optional, roles and prices merged */
export const SettingsPatchSchema = z.strictObject({
  roles: RolesSchema.partial().optional(),
  prices: z
    .strictObject({
      models: z.record(z.string(), ModelPriceSchema).optional(),
      voicePer1kChars: VoicePricesSchema.partial().optional(),
    })
    .optional(),
  globalMonthlyCapUsd: z.number().min(0).max(100_000).optional(),
  defaultHour: z.number().int().min(0).max(23).optional(),
  timezone: z.string().optional(),
});

export type RoleConfig = z.output<typeof RoleConfigSchema>;
export type ModelPrice = z.output<typeof ModelPriceSchema>;
export type Prices = z.output<typeof PricesSchema>;
export type SettingsValues = z.output<typeof SettingsSchema>;
export type SettingsPatch = z.input<typeof SettingsPatchSchema>;

export interface StudioSettings extends SettingsValues {
  /** Set when the Claude API refused the key or the credit ran out */
  warning: string | null;
  warningAt: Date | null;
}
