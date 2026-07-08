"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import type { CirclePhase, MemberProfile } from "@/lib/circle-view";
import { Avatar } from "./Avatar";

interface CircleRingProps {
  members: MemberProfile[];
  /** Member id receiving the pot this round, or null (forming / complete). */
  recipientId: number | null;
  /** Member ids who have already received their pot. */
  paidOutIds: number[];
  /** Member ids who missed at least one round. */
  defaultedIds: number[];
  /** 0-based index of the current round. */
  round: number;
  totalRounds: number;
  /** Pot a recipient receives this round, whole USDCx. */
  pot: string;
  phase: CirclePhase;
  /** Blocks until the escrow bond-lock expires, or null if unknown/expired. */
  blocksLeft: number | null;
}

const RADIUS = 38; // in the 0–100 SVG viewBox
const CENTER = 50;

/** Position of member `i` of `n` on the ring, in viewBox (0–100) coordinates. */
function nodePos(i: number, n: number) {
  const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
  return { cx: CENTER + RADIUS * Math.cos(angle), cy: CENTER + RADIUS * Math.sin(angle) };
}

const PHASE_LABEL: Record<CirclePhase, string> = {
  forming: "Forming",
  bonded: "Bonds locked",
  active: "Live",
  complete: "Complete",
};

/**
 * The living circle — members arranged on a ring, the pot visibly flowing to the
 * current recipient. This is the emotional + technical centerpiece: real people,
 * real money moving, secured by Bitcoin.
 */
export function CircleRing({
  members,
  recipientId,
  paidOutIds,
  defaultedIds,
  round,
  totalRounds,
  pot,
  phase,
  blocksLeft,
}: CircleRingProps) {
  const reduce = useReducedMotion();
  const n = members.length;
  const recipient = recipientId != null ? nodePos(members.findIndex((m) => m.id === recipientId), n) : null;
  const isLive = phase === "active" && recipient != null;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-md bg-vault-glow px-4 sm:px-0">
      {/* Spokes + flowing pot token (SVG scales with the container). */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
        fill="none"
      >
        {members.map((m, i) => {
          const { cx, cy } = nodePos(i, n);
          const active = m.id === recipientId;
          return (
            <line
              key={m.id}
              x1={CENTER}
              y1={CENTER}
              x2={cx}
              y2={cy}
              stroke={active ? "var(--color-primary)" : "var(--color-border)"}
              strokeWidth={active ? 0.7 : 0.4}
              strokeOpacity={active ? 0.9 : 0.5}
            />
          );
        })}

        {isLive && recipient && !reduce && (
          <motion.circle
            r={2.4}
            fill="var(--color-primary)"
            initial={{ cx: CENTER, cy: CENTER, opacity: 0 }}
            animate={{ cx: [CENTER, recipient.cx], cy: [CENTER, recipient.cy], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.4 }}
            style={{ filter: "drop-shadow(0 0 3px var(--color-primary))" }}
          />
        )}
        {isLive && recipient && reduce && (
          <circle r={2.4} cx={recipient.cx} cy={recipient.cy} fill="var(--color-primary)" />
        )}
      </svg>

      {/* Center panel — round, pot, lock countdown. */}
      <div className="absolute left-1/2 top-1/2 flex w-[42%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
        <div className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
          {isLive && <span className="h-2 w-2 rounded-full bg-success animate-live-pulse" aria-hidden="true" />}
          <span>{PHASE_LABEL[phase]}</span>
        </div>
        {phase !== "complete" && phase !== "forming" && (
          <p className="mt-1 text-xs text-fg-muted">
            Round <span className="font-data text-fg">{Math.min(round + 1, totalRounds)}</span> / {totalRounds}
          </p>
        )}
        <p className="mt-1 font-data text-2xl font-medium text-gradient-gold sm:text-3xl">{pot}</p>
        <p className="-mt-0.5 text-[11px] uppercase tracking-wide text-fg-muted">USDCx pot</p>
        {blocksLeft != null && blocksLeft > 0 && (
          <p className="mt-2 inline-flex items-center gap-1 font-data text-[11px] text-fg-muted">
            <Lock className="h-3 w-3" aria-hidden="true" />
            {blocksLeft} blocks
          </p>
        )}
      </div>

      {/* Member avatars on the ring. */}
      {members.map((m, i) => {
        const { cx, cy } = nodePos(i, n);
        return (
          <div
            key={m.id}
            className="absolute flex flex-col items-center"
            style={{ left: `${cx}%`, top: `${cy}%`, transform: "translate(-50%, -50%)" }}
          >
            <Avatar
              id={m.id}
              name={m.name}
              size="lg"
              active={m.id === recipientId}
              muted={defaultedIds.includes(m.id) && m.id !== recipientId}
            />
            <span className="mt-1 inline-flex max-w-[7rem] items-center gap-0.5 text-xs font-medium text-fg">
              <span className="truncate">{m.name}</span>
              {paidOutIds.includes(m.id) && m.id !== recipientId && (
                <Check className="h-3 w-3 shrink-0 text-success" aria-label="received their pot" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
