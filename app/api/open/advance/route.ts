/**
 * POST /api/open/advance — drive a full open circle through its rotation.
 *
 * ⚠️ SERVER-ONLY, SIGNING PATH. Signs with ESCROW_KEY only (open circles are
 * escrow-driven once members have funded upfront). Refuses if the key is unset.
 *
 * Body: { id, confirm? }
 * Returns: { circle }
 */
import { NextResponse } from "next/server";
import { hasEscrowKey } from "@/lib/env";
import { advanceOpenCircle } from "@/lib/open-circle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Real testnet runs wait on block confirmations across several rounds.
export const maxDuration = 800;

export async function POST(req: Request) {
  let body: { id?: string; confirm?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const id = body.id;
  if (!id) return NextResponse.json({ error: "Missing 'id'." }, { status: 400 });

  if (!hasEscrowKey()) {
    return NextResponse.json(
      {
        error:
          "ESCROW_KEY is not configured. Set it in .env.local (testnet key only) " +
          "to run open circles. See createcircle.md.",
      },
      { status: 400 }
    );
  }

  try {
    const circle = await advanceOpenCircle(id, { confirm: body.confirm !== false });
    return NextResponse.json({ circle });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, id }, { status: 500 });
  }
}
