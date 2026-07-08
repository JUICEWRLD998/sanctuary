"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { CircleResponse, CircleView, MemberProfile } from "@/lib/circle-view";
import type { StreakStatus } from "@/components/StreakBar";
import { Avatar } from "@/components/Avatar";
import { CircleRing } from "@/components/CircleRing";
import { MemberCard } from "@/components/MemberCard";
import { RoundTimeline } from "@/components/RoundTimeline";
import { AutopilotButton } from "@/components/AutopilotButton";
import { BitcoinBadge } from "@/components/BitcoinBadge";
import { LobbyJoin } from "@/components/LobbyJoin";
import { CopyLink } from "@/components/CopyLink";
import { ExplorerLink } from "@/components/ExplorerLink";
import { OutcomeReveal } from "@/components/OutcomeReveal";
import { OUTCOMES, STORY } from "@/content/story";

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
        <div className="flex items-center justify-end">
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

      {loading && (
        <div className="mt-10">
          <CircleSkeleton />
          <p className="mt-4 text-center text-sm text-fg-muted">
            Loading circle data from testnet...
          </p>
        </div>
      )}

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

  // Open (real-user) circles that are still filling render a lobby instead of
  // the rotation hero — people join with their own wallets first.
  const isOpen = circle.kind === "open";
  if (isOpen && circle.phase === "forming") {
    return <LobbyView id={id} circle={circle} members={members} onRefetchNeeded={onRefetchNeeded} />;
  }

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

  // The most recently landed pot → the "outcome reveal" (implementation.md §5).
  // While active, that's the recipient of the last settled round; once complete,
  // the final recipient in the payout order.
  const landedIndex =
    circle.phase === "complete"
      ? circle.payoutOrder.length - 1
      : circle.currentRound - 1;
  const landedId = landedIndex >= 0 ? circle.payoutOrder[landedIndex] : null;
  const landedMember = landedId != null ? members.find((m) => m.id === landedId) : null;
  const landed =
    landedMember != null
      ? {
          id: landedMember.id,
          name: landedMember.name,
          // Managed demo members have a scripted outcome line; open-circle
          // members get one built from the purpose they entered.
          outcome:
            OUTCOMES[landedMember.name] ??
            (landedMember.reason
              ? `${landedMember.name}'s pot lands — ${landedMember.reason.toLowerCase()}.`
              : `${landedMember.name}'s pot has landed.`),
        }
      : null;

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

        {landed && <OutcomeReveal recipient={landed} pot={pot} complete={circle.phase === "complete"} />}

        {/* Nothing to run once a circle is complete (e.g. the seeded demo) — every
            transaction has already settled, so the button would be a no-op. */}
        {circle.phase !== "complete" && (
          <div>
            <AutopilotButton circleId={id} open={isOpen} onComplete={onRefetchNeeded} />
          </div>
        )}

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

      {circle.escrow.held != null && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-2">
          <dt className="text-[10px] uppercase tracking-wide text-fg-muted">USDCx held at escrow</dt>
          <dd className="font-data text-sm text-fg">{circle.escrow.held}</dd>
        </div>
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

/**
 * The lobby for an open (real-user) circle that is still filling: shows who has
 * joined and what they're saving for, an empty-seat count, the join card, and a
 * live read of the bonds already landed at the escrow. Once the last seat fills,
 * the server auto-forms the circle and this view gives way to the rotation hero.
 */
function LobbyView({
  id,
  circle,
  members,
  onRefetchNeeded,
}: {
  id: string;
  circle: CircleView;
  members: MemberProfile[];
  onRefetchNeeded: () => void;
}) {
  const capacity = circle.capacity ?? circle.memberCount;
  const joined = members.length;
  const emptySeats = Math.max(0, capacity - joined);
  const joinedAddresses = (circle.members ?? []).map((m) => m.address);
  const upfront = Number(circle.bond) + (capacity - 1) * Number(circle.contribution);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onRefetchNeeded}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-xs text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Refresh lobby"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </button>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Forming · {joined} of {capacity} joined
          </p>
          <h1 className="mt-2 text-balance text-2xl font-bold leading-tight sm:text-3xl">
            {circle.title ?? "A savings circle"}
          </h1>
          <p className="mt-3 text-balance text-sm text-fg-muted">
            Each member funds {upfront} USDCx upfront and receives the {(capacity - 1) * Number(circle.contribution)} USDCx
            pot on their turn. When the last seat is taken, the bonds lock and the pot starts
            rotating automatically.
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-fg-muted">
            The circle so far
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
                <Avatar id={m.id} name={m.name} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold text-fg">{m.name}</p>
                  <p className="truncate text-xs text-fg-muted">Saving for {m.reason.toLowerCase()}</p>
                </div>
              </div>
            ))}
            {Array.from({ length: emptySeats }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface/50 p-4 text-fg-muted"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border text-lg">
                  +
                </div>
                <p className="text-xs">Open seat</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <BitcoinBadge variant="full" />
          {emptySeats > 0 && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <h2 className="font-display text-sm font-semibold text-fg">Invite others</h2>
              <p className="mt-1 mb-3 text-xs text-fg-muted">
                Share this link to fill the {emptySeats} open{" "}
                {emptySeats === 1 ? "seat" : "seats"}.
              </p>
              <CopyLink path={`/circle/${id}`} label="circle invite link" />
            </div>
          )}
          <LobbyJoin
            circleId={id}
            escrowAddress={circle.escrow.address}
            capacity={capacity}
            contribution={circle.contribution}
            bond={circle.bond}
            joinedAddresses={joinedAddresses}
            onJoined={onRefetchNeeded}
          />
          {circle.escrow.held != null && (
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-fg">Bonds landed at escrow</h2>
                {circle.escrow.url && (
                  <ExplorerLink url={circle.escrow.url} label="escrow address">
                    view
                  </ExplorerLink>
                )}
              </div>
              <p className="mt-2 font-data text-lg text-fg">{circle.escrow.held} USDCx</p>
              <p className="mt-1 text-xs text-fg-muted">
                Real funds from members who&apos;ve already joined, held at the escrow on testnet.
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
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
