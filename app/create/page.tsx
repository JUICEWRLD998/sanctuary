"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { CopyLink } from "@/components/CopyLink";

/**
 * /create — start your own real savings circle (implementation: createcircle.md).
 * An organizer sets the shape (name, size, contribution, bond); we create an open
 * lobby and hand back a shareable invite link. Friends open it and join with their
 * own wallets; when every seat is taken the circle auto-forms and starts rotating.
 */
export default function CreateCirclePage() {
  const [title, setTitle] = useState("");
  const [capacity, setCapacity] = useState(3);
  const [contribution, setContribution] = useState("1");
  const [bond, setBond] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

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
      setCreatedId(data.id as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the circle.");
    } finally {
      setSubmitting(false);
    }
  }

  const invalid = !title.trim() || Number(contribution) <= 0 || capacity < 2;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-4 py-10 sm:px-6 sm:py-16">
      {createdId ? (
        <CreatedView
          id={createdId}
          title={title}
          capacity={capacity}
          upfront={upfront}
        />
      ) : (
        <>
          <header className="mt-8">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Start a circle</p>
            <h1 className="mt-2 text-balance text-2xl font-bold leading-tight sm:text-3xl">
              Create your own savings circle
            </h1>
            <p className="mt-3 text-balance text-sm text-fg-muted">
              Set the shape of your circle. Once it&apos;s created, you&apos;ll get a link to share —
              each member opens it, joins with their own wallet, and funds their share upfront. When
              every seat is taken, the pot starts rotating automatically.
            </p>
            <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-fg-muted">
                <span className="font-semibold text-primary">💡 Tip:</span> Start with a small circle (3 members) 
                and low amounts to test the flow. Each member needs testnet USDCx and STX for gas.
              </p>
            </div>
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
                aria-describedby="name-hint"
              />
              <span id="name-hint" className="text-xs text-fg-muted">
                Choose a memorable name that reflects your group&apos;s purpose
              </span>
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
                "Create circle"
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
        </>
      )}
    </main>
  );
}

/** Post-creation: the invite link to share, plus a way into the new circle. */
function CreatedView({
  id,
  title,
  capacity,
  upfront,
}: {
  id: string;
  title: string;
  capacity: number;
  upfront: number;
}) {
  return (
    <div className="mt-8">
      <header>
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Circle created
        </p>
        <h1 className="mt-2 text-balance text-2xl font-bold leading-tight sm:text-3xl">
          {title || "Your circle"} is ready
        </h1>
        <p className="mt-3 text-balance text-sm text-fg-muted">
          Share this link with the {capacity} people you want in the circle. Each opens it, connects
          their wallet, and funds their {upfront} USDCx share. When the last seat is taken, the pot
          starts rotating on its own.
        </p>
      </header>

      <div className="mt-6 rounded-lg border border-border bg-surface p-5">
        <h2 className="font-display text-sm font-semibold text-fg">Invite link</h2>
        <p className="mt-1 mb-3 text-xs text-fg-muted">
          Anyone with this link can join until every seat is filled.
        </p>
        <CopyLink path={`/circle/${id}`} label="circle invite link" />
      </div>

      <Link
        href={`/circle/${id}`}
        className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-gradient-gold px-5 py-3 font-medium text-primary-fg shadow-glow transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Open your circle
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>

      <p className="mt-4 text-center text-xs text-fg-muted">
        You can join your own circle from its page, too — you&apos;re a member like everyone else.
      </p>
    </div>
  );
}
