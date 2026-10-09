import type { PieceCatalog } from './catalog';
import { type PlanIssue, type Result, zodIssues } from './errors';
import { isSafeRelativePath } from './primitives';
import { type Plan, PlanSchema } from './schema';

/**
 * Parses a direction plan and checks what the schema alone cannot: unique ids, every voice line
 * used by exactly one scene, known pieces with valid params (defaults applied), and the length
 * limits of each piece for silent scenes.
 */
export function validatePlan(raw: unknown, catalog: PieceCatalog): Result<Plan> {
  const parsed = PlanSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const plan = parsed.data;
  const issues: PlanIssue[] = [];

  const sceneIds = new Set<string>();
  plan.scenes.forEach((scene, index) => {
    if (sceneIds.has(scene.id)) {
      issues.push({ path: `scenes.${index}.id`, message: `duplicate scene id "${scene.id}"` });
    }
    sceneIds.add(scene.id);
  });

  const lineUses = new Map<string, number>();
  plan.voice.lines.forEach((line, index) => {
    if (lineUses.has(line.id)) {
      issues.push({ path: `voice.lines.${index}.id`, message: `duplicate line id "${line.id}"` });
    }
    lineUses.set(line.id, 0);
  });

  const scenes = plan.scenes.map((scene, index) => {
    const at = `scenes.${index}`;
    if (scene.timing.kind === 'line') {
      const uses = lineUses.get(scene.timing.lineId);
      if (uses === undefined) {
        issues.push({ path: `${at}.timing.lineId`, message: `no voice line "${scene.timing.lineId}"` });
      } else {
        lineUses.set(scene.timing.lineId, uses + 1);
      }
    }
    if (index === plan.scenes.length - 1 && scene.transitionOut) {
      issues.push({
        path: `${at}.transitionOut`,
        message: 'the last scene cannot have a transition out',
      });
    }
    const piece = catalog.get(scene.piece);
    if (!piece) {
      issues.push({ path: `${at}.piece`, message: `unknown piece "${scene.piece}"` });
      return scene;
    }
    if (
      scene.timing.kind === 'seconds' &&
      (scene.timing.seconds < piece.minSeconds || scene.timing.seconds > piece.maxSeconds)
    ) {
      issues.push({
        path: `${at}.timing.seconds`,
        message: `piece "${piece.id}" lasts between ${piece.minSeconds} and ${piece.maxSeconds} seconds`,
      });
    }
    const params = piece.paramsSchema.safeParse(scene.params);
    if (!params.success) {
      issues.push(...zodIssues(params.error, `${at}.params`));
      return scene;
    }
    let assetsOk = true;
    for (const key of piece.assetParams) {
      const value = params.data[key];
      if (value === undefined) continue;
      if (typeof value !== 'string') {
        issues.push({ path: `${at}.params.${key}`, message: 'must be an asset path' });
        assetsOk = false;
      } else if (!isSafeRelativePath(value)) {
        issues.push({
          path: `${at}.params.${key}`,
          message: 'must be a relative path inside the assets folder',
        });
        assetsOk = false;
      }
    }
    if (!assetsOk) return scene;
    return { ...scene, params: params.data };
  });

  for (const [id, uses] of lineUses) {
    if (uses !== 1) {
      issues.push({
        path: 'voice.lines',
        message:
          uses === 0 ? `line "${id}" is not used by any scene` : `line "${id}" is used by ${uses} scenes`,
      });
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: { ...plan, scenes } };
}

/** Every asset file the plan needs, relative to the assets folder */
export function collectAssetPaths(plan: Plan, catalog: PieceCatalog): string[] {
  const paths = new Set<string>();
  if (plan.brand.logo) paths.add(plan.brand.logo);
  if (plan.music) paths.add(plan.music.track);
  for (const scene of plan.scenes) {
    for (const key of catalog.get(scene.piece)?.assetParams ?? []) {
      const value = scene.params[key];
      if (typeof value === 'string') paths.add(value);
    }
  }
  return [...paths].sort();
}
