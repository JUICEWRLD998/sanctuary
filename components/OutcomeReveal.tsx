"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Avatar } from "./Avatar";

interface OutcomeRevealProps {
  /** The member whose pot just landed, or null when no pot has landed yet. */
  recipient: { id: number; name: string; outcome: string } | null;
  /** Whole-USDCx pot that landed. */
  pot: string;
  /** True once the whole circle has completed — shifts the copy to a wrap-up. */
  complete: boolean;
}

/**
 * The outcome reveal (implementation.md §5, Phase 5): when a pot lands, we don't
 * just show a txid — we show what it *meant* for a real person ("Amara's pot
 * covers her daughter's school fees"). This is the emotional payoff the whole
 * hero hangs on. Keyed by recipient so each new landing animates in; respects
 * reduced-motion.
 */
export function OutcomeReveal({ recipient, pot, complete }: OutcomeRevealProps) {
  const reduce = useReducedMotion();
  if (!recipient) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={recipient.id}
        role="status"
        aria-live="polite"
        className="relative overflow-hidden rounded-lg border border-primary/30 bg-surface bg-vault-glow p-5 shadow-glow"
        initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
      >
        <div className="flex items-start gap-4">
          <Avatar id={recipient.id} name={recipient.name} size="lg" active />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {complete ? "Circle complete" : "Pot landed"}
            </p>
            <p className="mt-1 text-balance text-base font-medium leading-snug text-fg sm:text-lg">
              {recipient.outcome}
            </p>
            <p className="mt-2 font-data text-sm text-fg-muted">
              <span className="text-gradient-gold">{pot} USDCx</span> received by {recipient.name},
              settled on-chain.
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
