/**
 * Extract all unique https/http URLs from a text string.
 * Preserves insertion order and removes duplicates.
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [];
  return [...new Set(matches)];
}
