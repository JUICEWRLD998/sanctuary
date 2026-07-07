/**
 * lib/ledger.ts — the canonical circle schema + persistence facade.
 *
 * A circle's entire life is one {@link CircleState}: every on-chain action
 * appends a {@link LedgerEvent} carrying its real testnet txid, so the ledger
 * doubles as the audit trail the bounty requires.
 *
 * Persistence lives behind this facade (lib/store): the filesystem for local
 * dev + scripts, Neon/Postgres in production (Vercel's filesystem is read-only),
 * with the bundled demo seeds always available as a read fallback. Callers here
 * are unchanged — same function names, same signatures.
 *
 * Types are defined in lib/ledger-types and re-exported below so existing
 * `import { … } from "@/lib/ledger"` sites keep working.
 *
 * SERVER-ONLY.
 */
export type {
  CirclePhase,
  EventKind,
  LedgerEvent,
  EscrowSnapshot,
  RoundRecord,
  CircleKind,
  CircleMember,
  CircleState,
} from "./ledger-types";

import type { CircleState, LedgerEvent } from "./ledger-types";
import { storeLoad, storeSave, storeList, storeDelete } from "./store";

/** Load a circle by id, or null if it doesn't exist yet. */
export async function loadCircle(id: string): Promise<CircleState | null> {
  return storeLoad(id);
}

/** Persist a circle, stamping `updatedAt`. */
export async function saveCircle(state: CircleState): Promise<CircleState> {
  return storeSave(state);
}

/** List all persisted circle ids. */
export async function listCircleIds(): Promise<string[]> {
  return storeList();
}

/** Delete a circle's persisted state (used to re-seed a fresh demo). */
export async function deleteCircle(id: string): Promise<void> {
  return storeDelete(id);
}

/** Append an event (timestamp filled in) and return the mutated state. */
export function appendEvent(state: CircleState, event: Omit<LedgerEvent, "at">): CircleState {
  state.events.push({ ...event, at: new Date().toISOString() });
  return state;
}
