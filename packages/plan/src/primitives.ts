import { z } from 'zod';

/** Lowercase words joined by single dashes: ids of scenes, voice lines and pieces */
export const Slug = z
  .string()
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase words joined by dashes');

export const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a #rrggbb color');

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg'] as const;
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac'] as const;

/**
 * A relative path that stays inside the assets folder: segments of letters, digits, ".", "_" and
 * "-", never empty, never "." or "..". Plans are written by agents, so this is a security check.
 */
export function isSafeRelativePath(value: string): boolean {
  if (value.length === 0 || value.length > 200) return false;
  return value
    .split('/')
    .every((segment) => segment !== '.' && segment !== '..' && /^[A-Za-z0-9._-]+$/.test(segment));
}

function assetPath(extensions: readonly string[], kind: string) {
  return z
    .string()
    .refine(
      isSafeRelativePath,
      'must be a relative path inside the assets folder (letters, digits, ".", "_", "-" and "/")',
    )
    .refine(
      (value) => extensions.some((extension) => value.toLowerCase().endsWith(`.${extension}`)),
      `must be ${kind} (${extensions.join(', ')})`,
    );
}

export const ImagePath = assetPath(IMAGE_EXTENSIONS, 'an image');
export const AudioPath = assetPath(AUDIO_EXTENSIONS, 'an audio file');
