/**
 * POST /api/open/join — record a real member who funded their upfront deposit.
 *
 * The wallet-side funding (split→escrow deposit of bond + contributions) happens
 * in the browser (LobbyJoin); this endpoint verifies the resulting txid on-chain
 * and appends the member to the roster. When the roster fills it auto-forms the
 * circle (which locks the bonds — that step needs ESCROW_KEY).
 *
 * Body: { id, address, name, purpose, fundTxid }
 * Returns: { circle }
 */
import { NextResponse } from "next/server";
import { hasEscrowKey } from "@/lib/env";
import { loadCircle } from "@/lib/ledger";
import { recordMember } from "@/lib/open-circle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Auto-form (the escrow bond-lock) waits on a block confirmation.
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: {
    id?: string;
    address?: string;
    name?: string;
    purpose?: string;
    fundTxid?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { id, address, name, purpose, fundTxid } = body;
  if (!id || !address || !name || !purpose || !fundTxid) {
    return NextResponse.json(
      { error: "Missing one of: id, address, name, purpose, fundTxid." },
      { status: 400 }
    );
  }

  // The escrow key is only needed for the auto-form/lock that fires when the LAST
  // seat is taken. Fail early with a clear message in that case so a member's
  // funds aren't stranded by a half-formed circle.
  const state = await loadCircle(id);
  const capacity = state?.capacity ?? state?.memberCount ?? 0;
  const willFill = (state?.members?.length ?? 0) + 1 >= capacity;
  if (willFill && !hasEscrowKey()) {
    return NextResponse.json(
      {
        error:
          "This join fills the circle, which locks the bonds — but ESCROW_KEY is " +
          "not configured on the server, so the escrow can't sign. Set it (testnet " +
          "only) and try again.",
      },
      { status: 400 }
    );
  }

  try {
    const circle = await recordMember({ id, address, name, purpose, fundTxid });
    return NextResponse.json({ circle });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
