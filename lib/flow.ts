/**
 * lib/flow.ts — thin, typed wrappers over flowvault-sdk for Sanctuary.
 *
 * SERVER-ONLY. This module instantiates FlowVault in `senderKey` mode, which
 * signs transactions with raw private keys. It must never be imported into a
 * client component. Keys come from server-only env (see lib/env.ts).
 *
 * The circle-engine composes these primitives:
 *   - setStrategyAndDeposit(): the atomic "route rules then deposit" pair the
 *     FlowVault contract executes together (LOCK / SPLIT / HOLD).
 *   - readState(): auditable balances for a principal.
 */

import { FlowVault, tokenToMicro, microToToken } from "flowvault-sdk";
import { NETWORK, FLOWVAULT } from "./constants";

/** Routing rules in whole-USDCx string terms (converted to micro internally). */
export interface Strategy {
  /** Amount to lock (whole USDCx). "0" = no lock. */
  lock?: string;
  /** Absolute Stacks block height the lock expires at. Required if lock > 0. */
  lockUntilBlock?: number;
  /** Recipient principal for the split, or null for no split. */
  splitAddress?: string | null;
  /** Amount forwarded to splitAddress (whole USDCx). "0" = no split. */
  split?: string;
}

export interface VaultState {
  address: string;
  total: string; // whole USDCx
  locked: string;
  unlocked: string;
  lockUntilBlock: number;
  currentBlock: number;
}

export interface TxRef {
  txid: string;
}

/** Build a FlowVault client bound to a signer key (backend automation mode). */
export function vaultFor(senderKey: string): FlowVault {
  return new FlowVault({
    network: NETWORK,
    senderKey,
    contractAddress: FLOWVAULT.contractAddress,
    contractName: FLOWVAULT.contractName,
    tokenContractAddress: FLOWVAULT.tokenContractAddress,
    tokenContractName: FLOWVAULT.tokenContractName,
  });
}

/** Extract a txid from the SDK's TransactionResult (txid | txId | id). */
function extractTxid(result: unknown): string {
  const r = (result ?? {}) as Record<string, unknown>;
  const raw = r.txid ?? r.txId ?? r.id ?? r.transaction ?? "";
  const txid = String(raw);
  if (!txid) throw new Error(`No txid in transaction result: ${JSON.stringify(result)}`);
  return txid;
}

/** Current Stacks tip height (needs any principal for the read call). */
export async function currentBlock(vault: FlowVault, principal: string): Promise<number> {
  return vault.getCurrentBlockHeight(principal);
}

/**
 * Set a routing strategy then deposit — the core FlowVault "program your money"
 * move. Returns both txids. The contract applies LOCK / SPLIT / HOLD atomically
 * on the deposit that follows the strategy.
 */
export async function setStrategyAndDeposit(
  vault: FlowVault,
  strategy: Strategy,
  depositAmount: string
): Promise<{ strategyTx: TxRef; depositTx: TxRef }> {
  const rules = {
    lockAmount: tokenToMicro(strategy.lock ?? "0"),
    lockUntilBlock: strategy.lockUntilBlock ?? 0,
    splitAddress: strategy.splitAddress ?? null,
    splitAmount: tokenToMicro(strategy.split ?? "0"),
  };

  const strategyResult = await vault.createStrategy(rules);
  const strategyTx = { txid: extractTxid(strategyResult) };

  const depositResult = await vault.deposit(tokenToMicro(depositAmount));
  const depositTx = { txid: extractTxid(depositResult) };

  return { strategyTx, depositTx };
}

/** Plain deposit with whatever strategy is already set (or none). */
export async function deposit(vault: FlowVault, amount: string): Promise<TxRef> {
  const result = await vault.deposit(tokenToMicro(amount));
  return { txid: extractTxid(result) };
}

/** Withdraw unlocked funds. */
export async function withdraw(vault: FlowVault, amount: string): Promise<TxRef> {
  const result = await vault.withdraw(tokenToMicro(amount));
  return { txid: extractTxid(result) };
}

/** Clear any routing rules so future deposits go straight to unlocked. */
export async function clearStrategy(vault: FlowVault): Promise<TxRef> {
  const result = await vault.clearRoutingRules();
  return { txid: extractTxid(result) };
}

/** Read-only, auditable vault state for a principal, in whole USDCx. */
export async function readState(vault: FlowVault, address: string): Promise<VaultState> {
  const s = await vault.getVaultState(address);
  return {
    address,
    total: microToToken(s.totalBalance),
    locked: microToToken(s.lockedBalance),
    unlocked: microToToken(s.unlockedBalance),
    lockUntilBlock: s.lockUntilBlock,
    currentBlock: s.currentBlock,
  };
}
