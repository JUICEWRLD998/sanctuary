/**
 * Hiro explorer + API helpers. Every on-chain action in Sanctuary is surfaced
 * as an auditable explorer link, satisfying the bounty's "auditable via explorer
 * links" requirement.
 */

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

/** Hiro testnet API base for programmatic status checks. */
export const HIRO_API = "https://api.testnet.hiro.so";

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
  { timeoutMs = 180_000, intervalMs = 4_000 }: { timeoutMs?: number; intervalMs?: number } = {}
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
