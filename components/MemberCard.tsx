import { Check, Crown } from "lucide-react";
import type { MemberProfile } from "@/lib/circle-view";
import { Avatar } from "./Avatar";
import { StreakBar, type StreakStatus } from "./StreakBar";

interface MemberCardProps {
  member: MemberProfile;
  segments: StreakStatus[];
  /** This member receives the pot in the current round. */
  isRecipient?: boolean;
  /** This member missed at least one round. */
  hasDefaulted?: boolean;
  /** This member has already received their pot. */
  paidOut?: boolean;
}

/**
 * One human in the circle: who they are, why they're saving, and their round
 * history. The reason line carries the emotional weight (school fees, rent…).
 */
export function MemberCard({
  member,
  segments,
  isRecipient = false,
  hasDefaulted = false,
  paidOut = false,
}: MemberCardProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-card transition-colors ${
        isRecipient ? "border-primary/50" : "border-border"
      }`}
    >
      <div className="flex items-center gap-3">
        <Avatar id={member.id} name={member.name} size="md" active={isRecipient} muted={hasDefaulted} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display font-semibold text-fg">{member.name}</span>
            {isRecipient && (
              <Crown className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="receiving this round" />
            )}
            {paidOut && !isRecipient && (
              <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-label="already received" />
            )}
          </div>
          <p className="truncate text-xs text-fg-muted">{member.city}</p>
        </div>
      </div>

      <p className="text-sm text-fg-muted text-balance">
        Saving for <span className="text-fg">{member.reason.toLowerCase()}</span>
      </p>

      <StreakBar segments={segments} name={member.name} />
    </div>
  );
}
