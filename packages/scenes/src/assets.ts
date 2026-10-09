import { staticFile } from 'remotion';

/** URL of a plan asset: the engine copies them to <public>/assets/<relative path> */
export function assetUrl(relativePath: string): string {
  return staticFile(`assets/${relativePath}`);
}
