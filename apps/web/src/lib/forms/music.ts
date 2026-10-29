/**
 * The music tracks the select offers: the ones in the data folder plus the line's stored track,
 * so a stored track that is no longer listed (file moved, folder unreadable) is kept instead of
 * replaced by "no music" on the next save
 */
export function musicOptions(available: string[], stored: string | null | undefined): string[] {
  return stored && !available.includes(stored) ? [...available, stored] : available;
}
