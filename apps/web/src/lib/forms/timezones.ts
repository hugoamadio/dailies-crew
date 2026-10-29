/**
 * The time zones the select offers: the browser's list, "UTC" (which that list lacks) and the
 * stored zone, so a stored value the list does not know is kept instead of replaced by the first
 * option on the next save
 */
export function timezoneOptions(supported: string[], stored: string): string[] {
  return [...new Set([...supported, 'UTC', stored])].sort();
}
