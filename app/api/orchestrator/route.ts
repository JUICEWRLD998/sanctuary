/**
 * POST /api/orchestrator — drive the managed demo circle on testnet.
 *
 * ⚠️ SERVER-ONLY, SIGNING PATH. This handler signs real testnet transactions
 * with the managed keys (senderKey mode). It never runs on the client and
 * refuses to act unless the signing keys are configured.
 *
 * Body: { action, id?, confirm?, defaults? }
 *   action   create | join | runRound | runAllRounds | complete | autopilot | reset
 *   id       circle id (default "demo")
 *   confirm  wait for each tx to settle before the next (default true)
 *   defaults Phase 2 — simulate defaults: { roundIndex: [memberId, …] }
 *
 * Actions are granular so the Phase 3 UI can advance a circle round-by-round,
 * and `autopilot` runs the whole lifecycle in one call for the live demo.
 */
import { NextResponse } from "next/server";
import { hasServerEnv } from "@/lib/env";
import { deleteCircle } from "@/lib/ledger";
import {
  autopilot,
  complete,
  createCircle,
  join,
  runAllRounds,
  runRound,
} from "@/lib/circle-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Real testnet runs wait on block confirmations; allow a generous ceiling on
// platforms that honour it (e.g. Vercel). Local dev is unbounded.
export const maxDuration = 800;

const DEFAULT_ID = "demo";

type Action =
  | "create"
  | "join"
  | "runRound"
  | "runAllRounds"
  | "complete"
  | "autopilot"
  | "reset";

export async function POST(req: Request) {
  let body: {
    action?: Action;
    id?: string;
    confirm?: boolean;
    /** Phase 2 — simulate defaults: { roundIndex: [memberId, …] }. */
    defaults?: Record<number, number[]>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const action = body.action;
  const id = body.id ?? DEFAULT_ID;
  const opts = { confirm: body.confirm !== false, defaults: body.defaults };

  if (!action) {
    return NextResponse.json({ error: "Missing 'action'." }, { status: 400 });
  }

  // Every signing action needs the managed keys. `reset`/`create` touch only
  // the ledger, but we still gate signing actions clearly.
  const needsKeys = action !== "reset" && action !== "create";
  if (needsKeys && !hasServerEnv()) {
    return NextResponse.json(
      {
        error:
          "Managed signing keys are not configured. Set ESCROW_KEY and " +
          "MEMBER_1_KEY…MEMBER_6_KEY in .env.local (testnet only) to run the " +
          "orchestrator. See implementation.md §Phase 0.",
      },
      { status: 400 }
    );
  }

  try {
    switch (action) {
      case "create":
        return NextResponse.json({ circle: await createCircle(id) });
      case "join":
        return NextResponse.json({ circle: await join(id, opts) });
      case "runRound":
        return NextResponse.json({ circle: await runRound(id, opts) });
      case "runAllRounds":
        return NextResponse.json({ circle: await runAllRounds(id, opts) });
      case "complete":
        return NextResponse.json({ circle: await complete(id, opts) });
      case "autopilot":
        return NextResponse.json({ circle: await autopilot(id, opts) });
      case "reset":
        await deleteCircle(id);
        return NextResponse.json({ ok: true, id });
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, action, id }, { status: 500 });
  }
}
