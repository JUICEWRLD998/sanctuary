/**
 * GET /api/circle?id=demo — read a circle's live state.
 *
 * Returns the persisted ledger enriched with explorer links for every on-chain
 * event, the member roster, and (when signing keys are configured) a live read
 * of the escrow's on-chain vault so the UI can prove the bond LOCK is real.
 *
 * Read-only. Safe to call from the client.
 */
import { NextResponse } from "next/server";
import { addressUrl, fetchAddressUsdcx, txUrl, withEventUrls } from "@/lib/explorer";
import { loadCircle, type CircleMember, type CircleState } from "@/lib/ledger";
import { MEMBER_PROFILES, type MemberProfile } from "@/lib/members";
import { hasServerEnv } from "@/lib/env";

/** A short, on-brand rendering of a Stacks address (identity for open members). */
function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 5)}…${address.slice(-4)}` : address;
}

/**
 * The member roster the UI renders. Open (real-user) circles carry their own
 * members (real wallets); their `purpose` becomes the "saving for" line and a
 * short address stands in for the location field. Managed demo circles fall back
 * to the seeded MEMBER_PROFILES.
 */
function rosterFor(state: CircleState): MemberProfile[] {
  if (state.kind === "open") {
    return (state.members ?? []).map((m: CircleMember) => ({
      id: m.id,
      name: m.name,
      city: shortAddress(m.address),
      reason: m.purpose,
      emoji: "",
    }));
  }
  return [...MEMBER_PROFILES];
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The escrow/vault reads below hit the chain through the SDK's patched `fetch`.
// Next's App Router persists a Data Cache to disk, which would otherwise serve a
// STALE vault read (e.g. an empty escrow captured before a circle was seeded).
// Force every fetch in this route to bypass that cache so the proof panel is live.
export const fetchCache = "force-no-store";

const DEFAULT_ID = "demo";

/** Live, auditable read of the escrow vault (only when keys are configured). */
async function readEscrowState() {
  if (!hasServerEnv()) return null;
  try {
    // Imported lazily so the read path never pulls signing code unless needed.
    const { getEscrow } = await import("@/lib/members");
    const { readState } = await import("@/lib/flow");
    const escrow = getEscrow();
    const vaultState = await readState(escrow.vault, escrow.address);
    return { ...vaultState, url: addressUrl(escrow.address) };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? DEFAULT_ID;

  const state = await loadCircle(id);
  if (!state) {
    return NextResponse.json(
      { error: `Circle "${id}" not found.`, id, exists: false },
      { status: 404 }
    );
  }

  // The escrow is a single shared managed principal, so a *live* read reflects
  // whatever circle is running now. A completed circle instead serves the
  // snapshot of its OWN final escrow state (captured at completion, drained to
  // 0) so a later live circle's balance never leaks onto it. Active/forming
  // circles read live — the raw held-token balance is a public read, so a
  // judge's fresh wallet-join bond shows up even without the orchestrator env.
  const snapshot = state.phase === "complete" ? state.escrow.snapshot ?? null : null;
  const [escrowLive, escrowHeld] = snapshot
    ? [
        { ...snapshot, url: state.escrow.address ? addressUrl(state.escrow.address) : null },
        snapshot.total,
      ]
    : await Promise.all([
        readEscrowState(),
        state.escrow.address ? fetchAddressUsdcx(state.escrow.address) : Promise.resolve(null),
      ]);

  return NextResponse.json({
    exists: true,
    circle: {
      ...state,
      events: withEventUrls(state.events),
      escrow: {
        ...state.escrow,
        url: state.escrow.address ? addressUrl(state.escrow.address) : null,
        live: escrowLive,
        held: escrowHeld,
        bondLockUrl: state.escrow.bondLockTxid ? txUrl(state.escrow.bondLockTxid) : null,
      },
    },
    members: rosterFor(state),
  });
}
