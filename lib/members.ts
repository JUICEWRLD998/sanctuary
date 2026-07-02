/**
 * lib/members.ts — the six named humans of the demo circle, plus the escrow.
 *
 * Profiles (names, cities, reasons) are public and safe to render anywhere —
 * they carry the emotional layer (implementation.md §4). Signing keys are pulled
 * from server-only env (lib/env.ts) and each principal's Stacks address is
 * DERIVED from its key, so we never hand-maintain address/key pairs that could
 * drift apart.
 *
 * `getCircleActors()` is server-only (it needs the keys). `MEMBER_PROFILES` is
 * import-safe on the client for the story UI.
 */
import { getAddressFromPrivateKey } from "@stacks/transactions";
import { FlowVault } from "flowvault-sdk";
import { NETWORK } from "./constants";
import { requireServerEnv } from "./env";
import { vaultFor } from "./flow";

/** Public, render-safe member profile (no key material). */
export interface MemberProfile {
  /** Stable 0-based index; also the default payout position. */
  id: number;
  name: string;
  city: string;
  /** Why they joined — surfaced in the story/outcome UI. */
  reason: string;
  emoji: string;
}

/** A member (or the escrow) resolved with an address and a signing vault client. */
export interface Actor extends Omit<MemberProfile, never> {
  address: string;
  /** FlowVault client bound to this actor's signing key (server-only). */
  vault: FlowVault;
}

/**
 * The six demo members. Names/reasons are illustrative diaspora + community
 * savings stories — the kind of real circle Sanctuary is built for.
 */
export const MEMBER_PROFILES: readonly MemberProfile[] = [
  { id: 0, name: "Amara", city: "Lagos", reason: "School fees for her daughter", emoji: "🌸" },
  { id: 1, name: "Chidi", city: "London", reason: "First month's rent deposit", emoji: "🏠" },
  { id: 2, name: "Fatima", city: "Nairobi", reason: "A refrigerator for her shop", emoji: "🧊" },
  { id: 3, name: "Marco", city: "Lisbon", reason: "Tools to start contracting", emoji: "🔧" },
  { id: 4, name: "Priya", city: "Toronto", reason: "A visa application fee", emoji: "✈️" },
  { id: 5, name: "Kwame", city: "Accra", reason: "Seed stock for market week", emoji: "🌾" },
] as const;

/** Escrow display metadata (the app-run coordinator principal). */
export const ESCROW_PROFILE = {
  name: "Sanctuary Escrow",
  emoji: "🛡️",
} as const;

let cached: { escrow: EscrowActor; members: Actor[] } | null = null;

/** The escrow actor (no member profile fields). */
export interface EscrowActor {
  name: string;
  emoji: string;
  address: string;
  vault: FlowVault;
}

/**
 * Resolve every signing actor for the managed circle: the escrow and all six
 * members, each with a derived testnet address and a key-bound FlowVault client.
 *
 * SERVER-ONLY — throws via {@link requireServerEnv} if keys are not configured.
 * Result is memoised for the process lifetime.
 */
export function getCircleActors(): { escrow: EscrowActor; members: Actor[] } {
  if (cached) return cached;

  const { escrowKey, memberKeys } = requireServerEnv();

  const escrow: EscrowActor = {
    name: ESCROW_PROFILE.name,
    emoji: ESCROW_PROFILE.emoji,
    address: getAddressFromPrivateKey(escrowKey, NETWORK),
    vault: vaultFor(escrowKey),
  };

  const members: Actor[] = MEMBER_PROFILES.map((profile, i) => {
    const key = memberKeys[i];
    return {
      ...profile,
      address: getAddressFromPrivateKey(key, NETWORK),
      vault: vaultFor(key),
    };
  });

  cached = { escrow, members };
  return cached;
}

/** Convenience: just the six member actors (server-only). */
export function getMembers(): Actor[] {
  return getCircleActors().members;
}

/** Convenience: the escrow actor (server-only). */
export function getEscrow(): EscrowActor {
  return getCircleActors().escrow;
}
