"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { BitcoinBadge } from "@/components/BitcoinBadge";

/**
 * /create — start your own real savings circle (implementation: createcircle.md).
 * An organizer sets the shape (name, size, contribution, bond); we create an open
 * lobby and route to its page, where real members join with their own wallets.
 */
export default function CreateCirclePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [capacity, setCapacity] = useState(3);
  const [contribution, setContribution] = useState("1");
  const [bond, setBond] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upfront = Number(bond) + (capacity - 1) * Number(contribution);
  const pot = (capacity - 1) * Number(contribution);

  async function onCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/open/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, capacity, contribution, bond }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the circle.");
      router.push(`/circle/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the circle.");
      setSubmitting(false);
    }
  }

  const invalid = !title.trim() || Number(contribution) <= 0 || capacity < 2;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Home
        </Link>
        <BitcoinBadge variant="chip" />
      </div>

      <header className="mt-8">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Start a circle</p>
        <h1 className="mt-2 text-balance text-2xl font-bold leading-tight sm:text-3xl">
          Create your own savings circle
        </h1>
        <p className="mt-3 text-balance text-sm text-fg-muted">
          Set the shape of your circle. Once it&apos;s created, share the link — each member joins
          with their own wallet and funds their share upfront. When every seat is taken, the pot
          starts rotating automatically.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-5 rounded-lg border border-border bg-surface p-5">
        <label className="flex flex-col gap-1.5 text-sm text-fg">
          Circle name
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            placeholder="e.g. Lagos market women, July"
            className="min-h-[44px] rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-fg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-fg">
          Number of members: <span className="font-data text-primary">{capacity}</span>
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="accent-primary"
          />
          <span className="text-xs text-fg-muted">
            {capacity} members means {capacity} rounds — everyone gets one turn with the pot.
          </span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-fg">
            Contribution / round (USDCx)
            <input
              type="number"
              min="0"
              step="1"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              className="min-h-[44px] rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-fg">
            Commitment bond (USDCx)
            <input
              type="number"
              min="0"
              step="1"
              value={bond}
              onChange={(e) => setBond(e.target.value)}
              className="min-h-[44px] rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>

        {/* Live economics summary so the organizer sees what members commit to. */}
        <dl className="grid grid-cols-2 gap-2 rounded-md bg-surface-2 p-3 text-center">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-fg-muted">Each member funds</dt>
            <dd className="font-data text-sm text-fg">{upfront} USDCx</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-fg-muted">Pot each round</dt>
            <dd className="font-data text-sm text-fg">{pot} USDCx</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={onCreate}
          disabled={submitting || invalid}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-gradient-gold px-5 py-3 font-medium text-primary-fg shadow-glow transition-transform duration-200 hover:enabled:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Creating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Create circle
            </>
          )}
        </button>

        {error && (
          <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-fg-muted">
        Testnet only. Members fund their share themselves; the escrow only routes the pot.
      </p>
    </main>
  );
}
