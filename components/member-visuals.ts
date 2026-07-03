/**
 * Shared member visual helpers — initials + a stable warm tint per member so
 * avatars are distinguishable in the ring while staying inside the Warm Vault
 * palette (clay / terracotta / amber family, never a cold or off-brand hue).
 */

/** Warm avatar tints (clay → terracotta → amber), assigned stably by member id. */
const AVATAR_TINTS = ["#C67B5C", "#D08A4E", "#B5651D", "#C9925A", "#A85A3C", "#D9A441"];

/** First initial(s) of a name, e.g. "Amara" → "A". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

/** Stable warm tint for a member id. */
export function memberTint(id: number): string {
  return AVATAR_TINTS[id % AVATAR_TINTS.length];
}
