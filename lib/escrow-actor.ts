/**
 * lib/escrow-actor.ts — resolve the app-run escrow signing actor.
 *
 * SERVER-ONLY. Open (real-user) circles are driven entirely by the escrow: once
 * members have funded upfront, the escrow signs every rotation and bond-return.
 * That needs only ESCROW_KEY — not the managed MEMBER_*_KEY set the demo uses —
 * so this is a lighter resolver than lib/members `getCircleActors()`.
 *
 * Kept in its own module so tests can mock this single seam (as the demo tests
 * mock lib/members) without pulling in key derivation.
 */
import { getAddressFromPrivateKey } from "@stacks/transactions";
import type { FlowVault } from "flowvault-sdk";
import { NETWORK } from "./constants";
import { requireEscrowKey } from "./env";
import { vaultFor } from "./flow";

export interface EscrowActor {
  /** The escrow principal's Stacks (testnet) address, derived from its key. */
  address: string;
  /** FlowVault client bound to the escrow's signing key (server-only). */
  vault: FlowVault;
}

let cached: EscrowActor | null = null;

/**
 * Resolve the escrow actor (address + key-bound vault client). Memoised for the
 * process lifetime. Throws via {@link requireEscrowKey} if ESCROW_KEY is unset.
 */
export function getEscrowActor(): EscrowActor {
  if (cached) return cached;
  const key = requireEscrowKey();
  cached = {
    address: getAddressFromPrivateKey(key, NETWORK),
    vault: vaultFor(key),
  };
  return cached;
}
