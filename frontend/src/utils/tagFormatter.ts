/**
 * Normalizes messy hashtag input into clean "#tag1 #tag2 #tag3" format.
 *
 * Handles all edge cases from the original Python tool:
 * - Chinese commas: "标签1，标签2" → "#标签1 #标签2"
 * - Concatenated hashes: "#tag1#tag2#tag3" → "#tag1 #tag2 #tag3"
 * - Mixed delimiters: "#tag1, tag2\ttag3" → "#tag1 #tag2 #tag3"
 * - Deduplication (case-insensitive)
 * - Auto-prefix with #
 *
 * Ported from publish_window.py format_tags()
 */
export function formatTags(raw: string): string {
  if (!raw) return "";

  const temp = raw
    .replace(/[，,\n\t]/g, " ") // normalize Chinese commas, newlines, tabs
    .replace(/#/g, " #"); // split concatenated # → " #" (critical for #a#b)

  const seen = new Set<string>();
  const valid: string[] = [];

  for (const part of temp.split(/\s+/)) {
    let clean = part.trim();
    if (!clean) continue;
    if (!clean.startsWith("#")) clean = "#" + clean;

    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      valid.push(clean);
    }
  }

  return valid.join(" ");
}

/**
 * Split a formatted tag string into an array of individual tags.
 * Input: "#tag1 #tag2 #tag3"
 * Output: ["#tag1", "#tag2", "#tag3"]
 */
export function parseTags(formatted: string): string[] {
  if (!formatted) return [];
  return formatted
    .split(/\s+/)
    .filter((t) => t.startsWith("#") && t.length > 1);
}
