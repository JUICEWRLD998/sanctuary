import { Bitcoin, ShieldCheck } from "lucide-react";

interface BitcoinBadgeProps {
  /** Compact chip vs. the fuller trust statement. */
  variant?: "chip" | "full";
  className?: string;
}

/**
 * "Secured by Bitcoin finality" trust marker. The circle's bonds are locked and
 * every move settles on Stacks, anchored to Bitcoin — this is the credibility
 * anchor of the whole product.
 */
export function BitcoinBadge({ variant = "chip", className = "" }: BitcoinBadgeProps) {
  if (variant === "full") {
    return (
      <div
        className={`flex items-center gap-3 rounded-lg border border-border bg-surface/60 px-4 py-3 ${className}`}
      >
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm text-fg-muted">
          <span className="font-medium text-fg">Secured by Bitcoin finality.</span> Bonds are locked
          on-chain and every contribution settles on Stacks — auditable, irreversible.
        </p>
      </div>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary ${className}`}
    >
      <Bitcoin className="h-3.5 w-3.5" aria-hidden="true" />
      Secured by Bitcoin
    </span>
  );
}
