/**
 * GET|POST /api/cron/complete-due — auto-return bonds for any circle that is due.
 *
 * A circle's commitment bonds stay LOCKED on-chain until its `endBlock`. After
 * the rounds finish, the bonds can only be returned once the chain reaches that
 * height — but nothing returns them on its own. This endpoint is the automated
 * trigger: a scheduler (cron-job.org / Vercel Cron) pokes it every few minutes,
 * and it sweeps EVERY circle, completing the ones whose lock has now expired.
 * No circle id needed — it handles whatever circles exist.
 *
 * Safe to call any time: for a circle that isn't due yet, `advanceOpenCircle`
 * does a single cheap block-height read and returns without moving funds.
 *
 * Auth: requires the CRON_SECRET, sent as `Authorization: Bearer <secret>` (or
 * an `x-cron-secret` header). Without CRON_SECRET configured the route refuses
 * to run, so it can never be triggered anonymously.
 *
 * SERVER-ONLY, SIGNING PATH (the escrow signs the bond returns).
 */
import { NextResponse } from "next/server";
import { hasEscrowKey } from "@/lib/env";
import { listCircleIds, loadCircle } from "@/lib/ledger";
import { advanceOpenCircle } from "@/lib/open-circle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Completing one circle is a short batch of escrow txs (reclaim + one return per
// member). 300s is the Hobby ceiling; we cap completions per run (below) so a
// single invocation stays well under it. Remaining due circles finish on the
// next scheduled run.
export const maxDuration = 300;

/** How many circles may actually be *completed* in a single invocation. */
const MAX_COMPLETIONS_PER_RUN = 1;

/** Validate the shared cron secret. */
function authorize(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return { ok: false, status: 503, error: "CRON_SECRET is not configured on the server." };
  }
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const provided = bearer || req.headers.get("x-cron-secret")?.trim() || "";
  if (provided !== secret) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }
  return { ok: true };
}

async function sweep(req: Request) {
  const auth = authorize(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // The escrow signs the bond returns; without its key nothing can be completed.
  if (!hasEscrowKey()) {
    return NextResponse.json(
      { error: "ESCROW_KEY is not configured — cannot sign bond returns." },
      { status: 400 }
    );
  }

  const ids = await listCircleIds();
  const scanned: string[] = [];
  const completed: string[] = [];
  const skipped: string[] = [];
  const errors: { id: string; error: string }[] = [];
  let completions = 0;

  for (const id of ids) {
    if (completions >= MAX_COMPLETIONS_PER_RUN) break;

    const circle = await loadCircle(id);
    // Only open, not-yet-complete circles whose rounds have all run are eligible
    // for a bond return; anything else is out of scope for this sweep.
    if (
      !circle ||
      circle.kind !== "open" ||
      circle.phase === "complete" ||
      circle.rounds.length === 0 ||
      circle.currentRound < circle.rounds.length
    ) {
      continue;
    }

    scanned.push(id);
    try {
      // Completes the circle iff its lock has expired; otherwise a cheap no-op.
      const after = await advanceOpenCircle(id, { confirm: true });
      if (after.phase === "complete") {
        completed.push(id);
        completions++;
      } else {
        skipped.push(id); // rounds done but lock still active — try again next run
      }
    } catch (err) {
      errors.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned,
    completed,
    skipped,
    errors,
    note:
      completions >= MAX_COMPLETIONS_PER_RUN
        ? "Reached the per-run completion cap; remaining due circles finish on the next run."
        : undefined,
  });
}

export async function GET(req: Request) {
  return sweep(req);
}

export async function POST(req: Request) {
  return sweep(req);
}
