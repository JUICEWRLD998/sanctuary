/**
 * lib/wallet.ts — browser wallet signing for the judge "join a round" flow.
 *
 * CLIENT-ONLY. Bridges the FlowVault SDK's `contractCallExecutor` mode to
 * @stacks/connect v8 (`request('stx_callContract', …)`), so a judge signs the
 * exact same LOCK/SPLIT/HOLD moves the managed engine makes — but with their own
 * wallet, no private key ever leaving it.
 *
 * The "join" a judge performs mirrors the real circle join (implementation.md §3
 * step 1): set a SPLIT routing rule to the escrow principal, then deposit — the
 * bond atomically routes into the app-run escrow, as a real testnet transaction.
 */
import { connect, disconnect, getLocalStorage, request } from "@stacks/connect";
import { PostConditionMode, postConditionToHex, serializeCV } from "@stacks/transactions";
import { FlowVault, tokenToMicro, type ContractCallRequest } from "flowvault-sdk";
import { FLOWVAULT, NETWORK } from "./constants";
import { HIRO_API } from "./explorer";

/** The connected Stacks (testnet) address, or null if not connected. */
export function connectedStxAddress(): string | null {
  try {
    return getLocalStorage()?.addresses.stx[0]?.address ?? null;
  } catch {
    return null;
  }
}

/** Open the wallet modal and return the connected STX address. */
export async function connectWallet(): Promise<string> {
  await connect();
  const address = connectedStxAddress();
  if (!address) throw new Error("No Stacks address returned by the wallet.");
  return address;
}

/** Disconnect and clear the stored session. */
export function disconnectWallet(): void {
  disconnect();
}

/** Map the SDK's post-condition mode (enum | string) to connect's name form. */
function modeName(mode: ContractCallRequest["postConditionMode"]): "allow" | "deny" {
  return mode === "deny" || mode === PostConditionMode.Deny ? "deny" : "allow";
}

/**
 * A FlowVault client that signs via the connected browser wallet. Read helpers
 * work too (they only need the sender address).
 */
export function walletVault(senderAddress: string): FlowVault {
  const executor = async (req: ContractCallRequest) => {
    // Bridge the SDK's generic request onto @stacks/connect's stx_callContract.
    // Serialize Clarity args and post-conditions to hex first: the SDK hands us
    // ClarityValue/PostCondition *objects* whose uint amounts are BigInt, which
    // don't survive the JSON-RPC hop to the wallet (surfacing as a generic
    // "Internal error"). Hex strings are the canonical, JSON-safe wire form that
    // @stacks/connect and the wallets accept (functionArgs/postConditions both
    // take `string[]`).
    return request("stx_callContract", {
      contract: `${req.contractAddress}.${req.contractName}`,
      functionName: req.functionName,
      functionArgs: req.functionArgs.map((arg) => serializeCV(arg)),
      network: req.network,
      postConditions: (req.postConditions ?? []).map((pc) => postConditionToHex(pc)),
      postConditionMode: modeName(req.postConditionMode),
    });
  };

  return new FlowVault({
    network: NETWORK,
    senderAddress,
    contractCallExecutor: executor,
    contractAddress: FLOWVAULT.contractAddress,
    contractName: FLOWVAULT.contractName,
    tokenContractAddress: FLOWVAULT.tokenContractAddress,
    tokenContractName: FLOWVAULT.tokenContractName,
  });
}

/** Pull a txid from the SDK's TransactionResult (txId in wallet mode). */
function txidOf(result: { txId?: string; txid?: string }): string {
  const id = result.txId ?? result.txid ?? "";
  if (!id || id === "wallet-submitted") {
    throw new Error("The wallet did not return a transaction id (it may have been cancelled).");
  }
  return id;
}

/**
 * Step 1 of the join: set a SPLIT routing rule sending `amount` USDCx to the
 * escrow on the next deposit. Returns the routing-rule txid (must confirm before
 * the deposit that consumes it).
 */
export async function setJoinStrategy(
  vault: FlowVault,
  escrowAddress: string,
  amount: string
): Promise<string> {
  const result = await vault.createStrategy({
    lockAmount: 0,
    lockUntilBlock: 0,
    splitAddress: escrowAddress,
    splitAmount: tokenToMicro(amount),
  });
  return txidOf(result);
}

/** Step 2 of the join: deposit `amount` USDCx — the stored split rule applies. */
export async function depositJoin(vault: FlowVault, amount: string): Promise<string> {
  const result = await vault.deposit(tokenToMicro(amount));
  return txidOf(result);
}

/** Read the connected wallet's spendable USDCx balance (whole USDCx). */
export async function fetchUsdcxBalance(address: string): Promise<number> {
  const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/balances`);
  if (!res.ok) throw new Error("Could not read the wallet balance.");
  const data = (await res.json()) as {
    fungible_tokens?: Record<string, { balance?: string }>;
  };
  const prefix = `${FLOWVAULT.tokenContractAddress}.${FLOWVAULT.tokenContractName}::`;
  for (const [assetId, info] of Object.entries(data.fungible_tokens ?? {})) {
    if (assetId.startsWith(prefix)) {
      return Number(info.balance ?? "0") / 1_000_000; // USDCx has 6 decimals
    }
  }
  return 0;
}
