/**
 * Canonical clue normalization, shared by the runtime lookup and the build
 * script that generates the clue bank (`scripts/build-cluebank.mjs` imports
 * this file directly, so the two can never drift — a mismatch here would
 * silently turn every lookup into a miss).
 *
 * The goal is that every way a setter might punctuate the same clue collapses
 * to one key: "Shakespeare's river", "SHAKESPEARE'S RIVER" and
 * "Shakespeare's river (4)" all become "shakespeares river".
 */
export function normalizeClue(raw: string): string {
  return raw
    .toLowerCase()
    // Apostrophes vanish rather than splitting a word, so "shakespeare's"
    // stays one token instead of becoming "shakespeare s".
    .replace(/['‘’]/g, '')
    // Parentheticals are metadata, not clue text: enumerations like "(4)",
    // "(2 wds.)", "(abbr.)", "(var.)".
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
