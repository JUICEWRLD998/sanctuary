export type StreakStatus = "paid" | "missed" | "recipient" | "pending";

const SEGMENT_STYLE: Record<StreakStatus, string> = {
  paid: "bg-success",
  // Diagonal stripes make "missed" distinguishable from "paid" by shape, not
  // color alone (colorblind-safe).
  missed:
    "bg-destructive bg-[image:repeating-linear-gradient(45deg,rgba(0,0,0,0.35)_0,rgba(0,0,0,0.35)_2px,transparent_2px,transparent_4px)]",
  recipient: "bg-gradient-gold",
  pending: "bg-surface-2 border border-border",
};

const SEGMENT_LABEL: Record<StreakStatus, string> = {
  paid: "contributed",
  missed: "missed",
  recipient: "received the pot",
  pending: "upcoming",
};

interface StreakBarProps {
  segments: StreakStatus[];
  /** Member name for the screen-reader summary. */
  name: string;
}

/**
 * Segmented round history for one member. Color carries meaning but is never the
 * only signal — each segment has a title + the bar has an aria summary, and the
 * "missed" segment additionally shows a slash so it's distinguishable.
 */
export function StreakBar({ segments, name }: StreakBarProps) {
  const paid = segments.filter((s) => s === "paid").length;
  const missed = segments.filter((s) => s === "missed").length;
  const summary = `${name}: ${paid} contributed${missed ? `, ${missed} missed` : ""}, over ${segments.length} rounds`;

  return (
    <div
      className="flex items-center gap-1"
      role="img"
      aria-label={summary}
    >
      {segments.map((status, i) => (
        <span
          key={i}
          title={`Round ${i + 1} — ${SEGMENT_LABEL[status]}`}
          className={`h-2 flex-1 rounded-full ${SEGMENT_STYLE[status]}`}
        />
      ))}
    </div>
  );
}
