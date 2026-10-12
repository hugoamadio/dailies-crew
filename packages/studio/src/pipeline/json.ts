import type { Prisma } from '@dailies-crew/db';

/** Plain data (zod outputs, plans) for a Json column */
export function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
