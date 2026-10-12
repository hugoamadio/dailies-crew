import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { expect } from 'vitest';
import type { z } from 'zod';

/** Every object of a JSON schema closes its properties, as structured outputs require */
function everyObjectClosed(node: unknown): boolean {
  if (Array.isArray(node)) return node.every(everyObjectClosed);
  if (!node || typeof node !== 'object') return true;
  const record = node as Record<string, unknown>;
  if (record.type === 'object' && record.additionalProperties !== false) return false;
  return Object.values(record).every(everyObjectClosed);
}

/** The SDK turns the zod schema into a JSON schema the structured outputs accept */
export function expectApiSchema(schema: z.ZodType): void {
  const format = zodOutputFormat(schema);
  expect(format.type).toBe('json_schema');
  expect(everyObjectClosed(format.schema)).toBe(true);
}
