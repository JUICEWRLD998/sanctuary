"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Play } from "lucide-react";

interface AutopilotButtonProps {
  circleId: string;
  /** Called after the run settles so the page can refetch live state. */
  onComplete?: () => void;
}

type Status = "idle" | "running" | "error";

/**
 * Primary CTA — drives the managed circle through its full lifecycle on testnet
 * (join → rounds → complete) via /api/orchestrator. One primary action per view;
 * disabled + spinner while broadcasting so it can't be double-fired.
 */
export function AutopilotButton({ circleId, onComplete }: AutopilotButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setStatus("running");
    setError(null);
    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "autopilot", id: circleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The run failed.");
      setStatus("idle");
      onComplete?.();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "The run failed.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={run}
        disabled={status === "running"}
        className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-5 py-3 font-medium text-primary-fg shadow-glow transition-transform duration-200 hover:enabled:scale-[1.02] active:enabled:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        aria-live="polite"
      >
        {status === "running" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Running on testnet…
          </>
        ) : (
          <>
            <Play className="h-4 w-4" aria-hidden="true" />
            Run the circle live
          </>
        )}
      </button>
      {status === "running" && (
        <p className="text-xs text-fg-muted">
          Broadcasting real testnet transactions and waiting on block confirmations — this takes a
          few minutes.
        </p>
      )}
      {status === "error" && error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
