"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { CircleResponse, CircleView, MemberProfile } from "@/lib/circle-view";
import type { StreakStatus } from "@/components/StreakBar";
import { CircleRing } from "@/components/CircleRing";
import { MemberCard } from "@/components/MemberCard";
import { RoundTimeline } from "@/components/RoundTimeline";
import { AutopilotButton } from "@/components/AutopilotButton";
import { BitcoinBadge } from "@/components/BitcoinBadge";
import { ConnectJoin } from "@/components/ConnectJoin";
import { ExplorerLink } from "@/components/ExplorerLink";
import { STORY } from "@/content/story";

/** Per-member round history, derived from the circle's rounds. */
function streakFor(member: MemberProfile, circle: CircleView): StreakStatus[] {
  return circle.rounds.map((r) => {
    if (r.recipientId === member.id) return "recipient";
    // `defaulters` is absent on ledgers seeded before Phase 2 — treat as none.
    if ((r.defaulters ?? []).includes(member.id)) return "missed";
    if (r.status === "complete") return "paid";
    return "pending";
  });
}

export default function CirclePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<CircleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/circle?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load the circle.");
      setData(json as CircleResponse);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the circle.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while a run may be in flight so live txs appear without a manual refresh.
  useEffect(() => {
    const active = data?.circle.phase === "active" || data?.circle.phase === "bonded";
    if (!active) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [data?.circle.phase, load]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold tracking-tight">Sanctuary</span>
            <BitcoinBadge variant="chip" />
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-xs text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Refresh circle state"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </button>
        </div>
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">{STORY.eyebrow}</p>
          <h1 className="mt-2 text-balance text-2xl font-bold leading-tight sm:text-4xl">
            {STORY.headline}
          </h1>
          <p className="mt-3 text-balance text-sm text-fg-muted sm:text-base">{STORY.subhead}</p>
        </div>
      </header>

      {loading && <CircleSkeleton />}

      {!loading && error && (
        <div className="mt-10 rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-fg">{error}</p>
          <p className="mt-2 text-sm text-fg-muted">
            Circle id: <span className="font-data">{id}</span>. Try running it to seed live state.
          </p>
        </div>
      )}

      {!loading && data && <CircleBody id={id} data={data} onRefetchNeeded={load} />}
    </main>
  );
}

function CircleBody({
  id,
  data,
  onRefetchNeeded,
}: {
  id: string;
  data: CircleResponse;
  onRefetchNeeded: () => void;
}) {
  const { circle, members } = data;
  const totalRounds = circle.rounds.length || circle.payoutOrder.length;

  const recipientId =
    circle.phase === "active" && circle.currentRound < circle.payoutOrder.length
      ? circle.payoutOrder[circle.currentRound]
      : null;
  const paidOutIds =
    circle.phase === "complete"
      ? circle.payoutOrder
      : circle.payoutOrder.slice(0, circle.currentRound);
  const defaultedIds = Array.from(new Set(circle.rounds.flatMap((r) => r.defaulters ?? [])));
  const pot = String((circle.memberCount - 1) * Number(circle.contribution));
  const live = circle.escrow.live;
  const blocksLeft =
    live?.currentBlock != null && circle.endBlock != null ? circle.endBlock - live.currentBlock : null;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Left: hero ring + members */}
      <section className="flex flex-col gap-8">
        <CircleRing
          members={members}
          recipientId={recipientId}
          paidOutIds={paidOutIds}
          defaultedIds={defaultedIds}
          round={circle.currentRound}
          totalRounds={totalRounds}
          pot={pot}
          phase={circle.phase}
          blocksLeft={blocksLeft}
        />

        <div>
          <AutopilotButton circleId={id} onComplete={onRefetchNeeded} />
        </div>

        <div>
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-fg-muted">
            The circle · {members.length} members
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                segments={streakFor(m, circle)}
                isRecipient={m.id === recipientId}
                hasDefaulted={defaultedIds.includes(m.id)}
                paidOut={paidOutIds.includes(m.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Right: proof + ledger */}
      <aside className="flex flex-col gap-6">
        <BitcoinBadge variant="full" />

        <ConnectJoin
          escrowAddress={circle.escrow.address}
          escrowName="the Sanctuary escrow"
          bond={circle.bond}
        />

        <EscrowProof circle={circle} />

        <div>
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-fg-muted">
            On-chain ledger
          </h2>
          <p className="mb-4 text-xs text-fg-muted text-balance">{STORY.proof}</p>
          <RoundTimeline events={circle.events} />
        </div>
      </aside>
    </div>
  );
}

/** Live, auditable escrow read — proves the bond LOCK is real on-chain. */
function EscrowProof({ circle }: { circle: CircleView }) {
  const live = circle.escrow.live;
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-fg">Escrow vault</h2>
        {circle.escrow.url && (
          <ExplorerLink url={circle.escrow.url} label="escrow address">
            view
          </ExplorerLink>
        )}
      </div>
      {live ? (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["Total", live.total],
            ["Locked", live.locked],
            ["Unlocked", live.unlocked],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md bg-surface-2 px-2 py-2">
              <dt className="text-[10px] uppercase tracking-wide text-fg-muted">{label}</dt>
              <dd className="font-data text-sm text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-xs text-fg-muted">
          Live vault read is available when the orchestrator keys are configured.
        </p>
      )}
      {circle.escrow.bondLockUrl && (
        <p className="mt-3 text-xs text-fg-muted">
          Bond lock:{" "}
          <ExplorerLink url={circle.escrow.bondLockUrl} label="bond lock transaction">
            transaction
          </ExplorerLink>
        </p>
      )}
    </div>
  );
}

function CircleSkeleton() {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-8">
        <div className="skeleton mx-auto aspect-square w-full max-w-md rounded-full" />
        <div className="skeleton h-12 w-48 rounded-md" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <div className="skeleton h-16 rounded-lg" />
        <div className="skeleton h-28 rounded-lg" />
        <div className="skeleton h-64 rounded-lg" />
      </div>
    </div>
  );
}
