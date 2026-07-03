import { initials, memberTint } from "./member-visuals";

const SIZES = {
  sm: { box: 32, text: "text-xs" },
  md: { box: 44, text: "text-sm" },
  lg: { box: 56, text: "text-base" },
} as const;

interface AvatarProps {
  id: number;
  name: string;
  size?: keyof typeof SIZES;
  /** Gold glow ring — used for the current round's recipient. */
  active?: boolean;
  /** Dimmed — used for a member who defaulted / is inactive. */
  muted?: boolean;
}

/**
 * Initials avatar in a warm clay disc. No emoji/photos needed — reads as a human
 * "face" while staying crisp and on-brand. `active` lights the recipient in gold.
 */
export function Avatar({ id, name, size = "md", active = false, muted = false }: AvatarProps) {
  const { box, text } = SIZES[size];
  const tint = memberTint(id);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-fg ring-2 transition-all duration-300 ${
        active ? "ring-primary shadow-glow" : "ring-black/30"
      } ${muted ? "opacity-40 grayscale" : ""} ${text}`}
      style={{
        width: box,
        height: box,
        background: `radial-gradient(120% 120% at 30% 25%, ${tint}, ${tint}cc 55%, ${tint}99)`,
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
