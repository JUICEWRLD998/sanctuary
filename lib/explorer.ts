/**
 * Hiro explorer + API helpers. Every on-chain action in Sanctuary is surfaced
 * as an auditable explorer link, satisfying the bounty's "auditable via explorer
 * links" requirement.
 */
import { FLOWVAULT } from "./constants";

const CHAIN = "testnet";

/** Normalize a txid to a 0x-prefixed lowercase hex string. */
export function normalizeTxid(txid: string): string {
  const t = txid.trim().toLowerCase();
  return t.startsWith("0x") ? t : `0x${t}`;
}

/** Public explorer URL for a transaction. */
export function txUrl(txid: string): string {
  return `https://explorer.hiro.so/txid/${normalizeTxid(txid)}?chain=${CHAIN}`;
}

/** Public explorer URL for an address. */
export function addressUrl(address: string): string {
  return `https://explorer.hiro.so/address/${address}?chain=${CHAIN}`;
}

/**
 * Explorer URL for a recorded event, or null for pure lifecycle markers that
 * carry no txid. Single source of truth so every consumer (the read API, the
 * scripts' progress logs) links events the same way.
 */
export function eventUrl(event: { txid?: string }): string | null {
  return event.txid ? txUrl(event.txid) : null;
}

/** Attach `url` to a list of recorded events (see {@link eventUrl}). */
export function withEventUrls<T extends { txid?: string }>(events: T[]): (T & { url: string | null })[] {
  return events.map((e) => ({ ...e, url: eventUrl(e) }));
}

/** Hiro testnet API base for programmatic status checks. */
export const HIRO_API = "https://api.testnet.hiro.so";

/**
 * Read an address's spendable USDCx balance (whole USDCx, as a string) from the
 * public Hiro API. No signing keys required, so it works even where the
 * orchestrator env is absent — used to surface bonds that have *landed* at the
 * escrow principal (e.g. a judge's wallet-mode join) before they're deposited
 * and LOCKed into the escrow's vault. Returns "0" on any error.
 */
export async function fetchAddressUsdcx(address: string): Promise<string> {
  try {
    const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/balances`);
    if (!res.ok) return "0";
    const data = (await res.json()) as {
      fungible_tokens?: Record<string, { balance?: string }>;
    };
    const prefix = `${FLOWVAULT.tokenContractAddress}.${FLOWVAULT.tokenContractName}::`;
    for (const [assetId, info] of Object.entries(data.fungible_tokens ?? {})) {
      if (assetId.startsWith(prefix)) {
        return String(Number(info.balance ?? "0") / 1_000_000); // USDCx: 6 decimals
      }
    }
    return "0";
  } catch {
    return "0";
  }
}

/**
 * Read the sender (origin) principal of a settled transaction from the public
 * Hiro API, or null if unavailable. Used to verify that an open-circle member's
 * upfront funding transaction was actually signed by the wallet that is joining
 * (not a replayed/borrowed txid). Best-effort: returns null on any error.
 */
export async function getTxSender(txid: string): Promise<string | null> {
  const id = normalizeTxid(txid);
  try {
    const res = await fetch(`${HIRO_API}/extended/v1/tx/${id}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { sender_address?: string };
    return data.sender_address ?? null;
  } catch {
    return null;
  }
}

export type TxStatus =
  | "pending"
  | "success"
  | "abort_by_response"
  | "abort_by_post_condition"
  | "unknown";

/** Poll the Hiro API for a transaction's settled status. */
export async function getTxStatus(txid: string): Promise<TxStatus> {
  const id = normalizeTxid(txid);
  try {
    const res = await fetch(`${HIRO_API}/extended/v1/tx/${id}`);
    if (res.status === 404) return "pending";
    if (!res.ok) return "unknown";
    const data = (await res.json()) as { tx_status?: string };
    return (data.tx_status as TxStatus) ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Wait until a transaction settles (success or abort), polling the Hiro API.
 * Returns the final status. Used by scripts and the orchestrator to sequence
 * dependent transactions safely.
 */
export async function waitForTx(
  txid: string,
  { timeoutMs = 180_000, intervalMs = 7_000 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<TxStatus> {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const status = await getTxStatus(txid);
    if (status !== "pending" && status !== "unknown") return status;
    if (Date.now() - start > timeoutMs) return status;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
