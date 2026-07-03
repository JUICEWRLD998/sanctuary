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
import { loadCircle } from "@/lib/ledger";
import { MEMBER_PROFILES } from "@/lib/members";
import { hasServerEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  // Live vault read needs keys; the raw held-token balance is a public read, so
  // a judge's fresh wallet-join bond shows up even without the orchestrator env.
  const [escrowLive, escrowHeld] = await Promise.all([
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
    members: MEMBER_PROFILES,
  });
}
