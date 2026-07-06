/**
 * POST /api/open/create — create a new OPEN (real-user) circle lobby.
 *
 * Ledger-only: no signing keys or chain access required, so anyone can start a
 * circle. Members fund and the escrow signs later (see /api/open/join, advance).
 *
 * Body: { title, capacity, contribution, bond }
 * Returns: { id, circle }
 */
import { NextResponse } from "next/server";
import { createOpenCircle } from "@/lib/open-circle";
import { loadCircle } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A short, url-safe, collision-resistant id derived from the title + a suffix. */
function makeId(title: string, suffix: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `${slug || "circle"}-${suffix}`;
}

export async function POST(req: Request) {
  let body: { title?: string; capacity?: number; contribution?: string; bond?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const capacity = Number(body.capacity);
  const contribution = String(body.contribution ?? "").trim();
  const bond = String(body.bond ?? "0").trim();

  if (!title) return NextResponse.json({ error: "A circle needs a name." }, { status: 400 });
  if (!Number.isFinite(capacity)) {
    return NextResponse.json({ error: "capacity must be a number." }, { status: 400 });
  }
  if (!contribution || Number(contribution) <= 0) {
    return NextResponse.json({ error: "contribution must be greater than 0." }, { status: 400 });
  }

  // Find a free id (retry on the rare slug collision).
  let id = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = (Date.now() + attempt).toString(36).slice(-5);
    const candidate = makeId(title, suffix);
    if (!(await loadCircle(candidate))) {
      id = candidate;
      break;
    }
  }
  if (!id) {
    return NextResponse.json({ error: "Could not allocate a circle id, try again." }, { status: 500 });
  }

  try {
    const circle = await createOpenCircle({ id, title, capacity, contribution, bond });
    return NextResponse.json({ id, circle });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
