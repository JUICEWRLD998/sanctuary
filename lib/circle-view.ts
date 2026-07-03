/**
 * lib/circle-view.ts — client-safe view types for the /api/circle response.
 *
 * Re-uses the canonical schema from lib/ledger via `import type` (erased at
 * build time, so no server-only `fs` code is pulled into the client bundle).
 */
import type { CircleState, LedgerEvent } from "./ledger";
import type { MemberProfile } from "./members";

/** A ledger event enriched with its explorer URL (or null for pure markers). */
export type EventView = LedgerEvent & { url: string | null };

/** Live, auditable read of the escrow vault (present only when keys are set). */
export interface EscrowLive {
  total: string;
  locked: string;
  unlocked: string;
  lockUntilBlock?: number | null;
  currentBlock?: number | null;
  url: string;
}

/** The circle as returned by the read API. */
export interface CircleView extends Omit<CircleState, "events" | "escrow"> {
  events: EventView[];
  escrow: {
    address: string | null;
    bondLockTxid: string | null;
    url: string | null;
    live: EscrowLive | null;
    bondLockUrl: string | null;
  };
}

/** Full /api/circle payload when the circle exists. */
export interface CircleResponse {
  exists: true;
  circle: CircleView;
  members: MemberProfile[];
}

export type { MemberProfile } from "./members";
export type { CirclePhase, EventKind, LedgerEvent, RoundRecord } from "./ledger";
