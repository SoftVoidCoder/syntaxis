/**
 * Normalize a company name for dedup comparison.
 * - Lowercase
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Strip all types of quotes: « » " " ' ' " '
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[«»""''\"\']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
