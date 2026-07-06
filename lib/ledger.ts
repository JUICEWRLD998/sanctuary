/**
 * lib/ledger.ts — the canonical circle schema + JSON persistence.
 *
 * The MVP deliberately avoids a database (implementation.md §4): a circle's
 * entire life is one JSON file under `data/circles/<id>.json`. Every on-chain
 * action appends a {@link LedgerEvent} carrying its real testnet txid, so the
 * ledger doubles as the audit trail the bounty requires ("auditable via
 * explorer links").
 *
 * SERVER-ONLY (uses the filesystem).
 */
import { promises as fs } from "fs";
import path from "path";

/** Where a circle sits in its lifecycle. */
export type CirclePhase = "forming" | "bonded" | "active" | "complete";

/** Category of an on-chain (or lifecycle) event, for UI grouping. */
export type EventKind =
  | "bond" // member forwards their commitment bond to escrow (SPLIT)
  | "escrow-lock" // escrow locks the pooled bonds (LOCK)
  | "contribution" // a member funds a round toward the recipient (SPLIT)
  | "default" // a member missed their contribution this round (no funds moved) — Phase 2
  | "payout" // marker: a round's pot has fully landed on the recipient
  | "compensation" // escrow makes a shorted recipient whole from forfeited bonds (SPLIT) — Phase 2
  | "bond-return" // escrow returns a bond after completion (SPLIT)
  | "member-join" // an open-circle member funded their bond + contributions upfront (SPLIT) — real-user flow
  | "circle-form" // an open circle filled its roster; bonds locked and rotation begins — real-user flow
  | "note"; // non-chain lifecycle marker

/** One recorded step in a circle's life; most carry a real testnet txid. */
export interface LedgerEvent {
  kind: EventKind;
  /** Human-readable summary for the timeline UI. */
  label: string;
  /** 0-based round index, when the event belongs to a round. */
  round?: number;
  /** Acting principal (address). */
  actor?: string;
  /** Receiving principal (address), for splits. */
  recipient?: string;
  /** Amount in whole USDCx. */
  amount?: string;
  /** On-chain transaction id (hex). Absent for pure lifecycle markers. */
  txid?: string;
  /** ISO timestamp the event was recorded. */
  at: string;
}

/**
 * A captured read of the escrow vault at a lifecycle milestone. The escrow is a
 * single shared managed principal, so a *live* read of it reflects whatever
 * circle happens to be running right now. A completed circle therefore renders
 * this snapshot of its OWN final state (drained to 0 once every bond is
 * returned) instead of leaking a later circle's live balance. Shape mirrors
 * lib/flow `VaultState` (+ `at`) so the UI can consume it unchanged.
 */
export interface EscrowSnapshot {
  total: string;
  locked: string;
  unlocked: string;
  lockUntilBlock: number;
  currentBlock: number;
  /** ISO timestamp of the read. */
  at: string;
}

/** Per-round progress and its resulting pot. */
export interface RoundRecord {
  index: number;
  /** Member id (index into the circle's members) who receives this round's pot. */
  recipientId: number;
  status: "pending" | "running" | "complete";
  /** Contribution txids collected this round. */
  contributionTxids: string[];
  /** Pot the recipient receives = (memberCount - 1) × contribution, whole USDCx. */
  potUsdcx: string;
  /**
   * Member ids who failed to contribute this round (Phase 2). A default moves
   * no funds during the round — the recipient is made whole at completion from
   * the defaulter's forfeited bond.
   */
  defaulters: number[];
  /** Amount the recipient was shorted this round (whole USDCx) = defaulters × contribution. */
  shortfallUsdcx: string;
  /** Escrow compensation txids that made the recipient whole (settled at completion). */
  compensationTxids: string[];
}

/**
 * How a circle is driven.
 *   "managed" — the seeded demo: members are server-held keys the orchestrator
 *               signs for (Amara/Chidi/Fatima). Absent on legacy files → managed.
 *   "open"    — the real-user flow: members are real wallets that join a lobby and
 *               fund upfront; the escrow auto-rotates. See createcircle.md.
 */
export type CircleKind = "managed" | "open";

/**
 * A real member of an OPEN circle (real-user flow). Unlike managed demo members
 * (lib/members.ts), these are self-custodial wallets — we never hold their key.
 * Their Stacks address is their unique id; name + purpose are their own words.
 */
export interface CircleMember {
  /** Stable 0-based index; also the join order and default payout position. */
  id: number;
  /** The member's own Stacks (testnet) address — their unique identity. */
  address: string;
  /** Display name the member entered when joining. */
  name: string;
  /** What they're saving the pot for — surfaced in the story/outcome UI. */
  purpose: string;
  /** txid of their upfront funding deposit (bond + contributions) into escrow. */
  fundTxid: string;
  /** ISO timestamp they joined. */
  joinedAt: string;
}

/** The complete persisted state of one savings circle. */
export interface CircleState {
  id: string;
  phase: CirclePhase;
  /** Managed demo vs. open real-user circle. Absent on legacy files ⇒ "managed". */
  kind?: CircleKind;
  /** Human-readable circle name (open circles). */
  title?: string;
  /** Target roster size for an open circle's lobby (equals memberCount once full). */
  capacity?: number;
  /**
   * Real members of an open circle, in join order. Absent for managed demo
   * circles, which resolve their roster from lib/members MEMBER_PROFILES.
   */
  members?: CircleMember[];
  memberCount: number;
  /** Per-member per-round contribution, whole USDCx. */
  contribution: string;
  /** Commitment bond escrowed at join, whole USDCx. */
  bond: string;
  /** Member ids in the order they receive the pot. */
  payoutOrder: number[];
  /** Index (into payoutOrder) of the next round to run. */
  currentRound: number;
  /** Stacks block height when bonds were locked. */
  createdBlock: number | null;
  /** Block height the escrow bond-lock expires at. */
  endBlock: number | null;
  escrow: {
    address: string | null;
    /** txid of the escrow's bond-lock deposit. */
    bondLockTxid: string | null;
    /**
     * Final escrow-vault read captured at {@link complete}. Optional so older
     * ledger files (and in-flight circles) load unchanged; when present it is
     * what the read API serves for completed circles instead of a live read of
     * the shared escrow principal.
     */
    snapshot?: EscrowSnapshot | null;
  };
  rounds: RoundRecord[];
  events: LedgerEvent[];
  /** ISO timestamp of the last mutation. */
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data", "circles");

function fileFor(id: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
    throw new Error(`Invalid circle id: ${JSON.stringify(id)}`);
  }
  return path.join(DATA_DIR, `${id}.json`);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/** Load a circle by id, or null if it doesn't exist yet. */
export async function loadCircle(id: string): Promise<CircleState | null> {
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    return JSON.parse(raw) as CircleState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** Persist a circle, stamping `updatedAt`. */
export async function saveCircle(state: CircleState): Promise<CircleState> {
  await ensureDir();
  const next = { ...state, updatedAt: new Date().toISOString() };
  await fs.writeFile(fileFor(state.id), JSON.stringify(next, null, 2), "utf8");
  return next;
}

/** List all persisted circle ids (newest file first). */
export async function listCircleIds(): Promise<string[]> {
  try {
    const files = await fs.readdir(DATA_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/** Delete a circle's ledger file (used to re-seed a fresh demo). */
export async function deleteCircle(id: string): Promise<void> {
  try {
    await fs.unlink(fileFor(id));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/** Append an event (timestamp filled in) and return the mutated state. */
export function appendEvent(state: CircleState, event: Omit<LedgerEvent, "at">): CircleState {
  state.events.push({ ...event, at: new Date().toISOString() });
  return state;
}
