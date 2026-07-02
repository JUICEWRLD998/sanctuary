/**
 * lib/env.ts — server-only access to the managed testnet signing keys.
 *
 * ⚠️ SERVER-ONLY. These are raw Stacks private keys used by the orchestrator to
 * sign real testnet transactions in `senderKey` mode. They must never reach the
 * client bundle. This module reads them from environment variables only:
 *
 *   ESCROW_KEY        — the app-run circle-escrow principal's private key
 *   MEMBER_1_KEY … MEMBER_6_KEY — one key per managed demo member
 *
 * Testnet only, always. See implementation.md §9 (risk 4).
 *
 * The module never throws at import time — a missing env just means "not
 * configured", so the UI and read-only paths still build and render. Signing
 * paths call `requireServerEnv()` which throws a clear, actionable error.
 */
import { CIRCLE } from "./constants";

/** Fail loudly if this module is ever evaluated in a browser context. */
if (typeof window !== "undefined") {
  throw new Error("lib/env.ts is server-only and must not be imported client-side.");
}

export interface ServerEnv {
  /** Private key of the circle-escrow principal. */
  escrowKey: string;
  /** Private keys of the managed demo members, in join order (length = memberCount). */
  memberKeys: string[];
}

const MEMBER_KEY_VARS = Array.from(
  { length: CIRCLE.memberCount },
  (_, i) => `MEMBER_${i + 1}_KEY`
);

/** Read a single env var, trimmed; undefined if absent/blank. */
function read(name: string): string | undefined {
  const v = process.env[name];
  const t = v?.trim();
  return t ? t : undefined;
}

/** True when every signing key needed to run the managed circle is present. */
export function hasServerEnv(): boolean {
  if (!read("ESCROW_KEY")) return false;
  return MEMBER_KEY_VARS.every((name) => read(name));
}

/**
 * Return all managed signing keys, or throw a precise error naming the missing
 * variables. Call this only from server-side signing paths (the orchestrator).
 */
export function requireServerEnv(): ServerEnv {
  const missing: string[] = [];

  const escrowKey = read("ESCROW_KEY");
  if (!escrowKey) missing.push("ESCROW_KEY");

  const memberKeys = MEMBER_KEY_VARS.map((name) => {
    const key = read(name);
    if (!key) missing.push(name);
    return key ?? "";
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing server-only signing keys: ${missing.join(", ")}. ` +
        `Set them in .env.local (testnet keys only) before running the orchestrator. ` +
        `See implementation.md §Phase 0.`
    );
  }

  return { escrowKey: escrowKey!, memberKeys };
}
