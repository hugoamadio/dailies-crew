import type { Db, Prisma } from '@dailies-crew/db';
import type { Line } from './lines/schema';

export interface ProductCandidate {
  id: string;
  createdAt: Date;
  /** When the line last made a video of it; null if never */
  lastVideoAt: Date | null;
}

/**
 * The products of the next videos of a line: first the ones that never got a video (oldest
 * first), then the one whose last video is the oldest. A product picked earlier in the same run
 * counts as just used, so a run of 3 repeats a product only when the line has fewer than 3.
 */
export function pickProducts(
  candidates: readonly ProductCandidate[],
  count: number,
  now: Date,
): string[] {
  const pool = candidates.map((candidate) => ({ ...candidate }));
  const picked: string[] = [];
  for (let index = 0; index < count && pool.length > 0; index += 1) {
    pool.sort((a, b) => {
      if (a.lastVideoAt === null && b.lastVideoAt !== null) return -1;
      if (b.lastVideoAt === null && a.lastVideoAt !== null) return 1;
      const byUse = (a.lastVideoAt?.getTime() ?? 0) - (b.lastVideoAt?.getTime() ?? 0);
      return byUse !== 0 ? byUse : a.createdAt.getTime() - b.createdAt.getTime();
    });
    const next = pool[0]!;
    picked.push(next.id);
    next.lastVideoAt = new Date(now.getTime() + index);
  }
  return picked;
}

export type MaterialChoice =
  { ok: true; productIds: (string | null)[] } | { ok: false; warning: string };

/** What the next `count` videos of the line are about; a line without material says so */
export async function chooseMaterial(
  db: Db,
  line: Line,
  count: number,
  now: Date,
): Promise<MaterialChoice> {
  if (line.kind !== 'product') return { ok: true, productIds: Array(count).fill(null) };
  const material = line.material;
  const where: Prisma.ProductWhereInput = { active: true };
  if (material.select === 'category') where.category = material.category;
  if (material.select === 'chosen') where.id = { in: material.productIds };
  const products = await db.product.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      videos: {
        where: { lineId: line.id },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  if (products.length === 0) {
    const which =
      material.select === 'all'
        ? 'no active product exists'
        : material.select === 'category'
          ? `no active product in category "${material.category}"`
          : 'none of the chosen products is active';
    return { ok: false, warning: `Nothing to show: ${which}` };
  }
  const candidates = products.map((product) => ({
    id: product.id,
    createdAt: product.createdAt,
    lastVideoAt: product.videos[0]?.createdAt ?? null,
  }));
  return { ok: true, productIds: pickProducts(candidates, count, now) };
}
