/**
 * Sanctuary — shared constants.
 *
 * Contract targets default to the FlowVault v2 testnet deployment (same values
 * baked into flowvault-sdk's DEFAULT_CONTRACTS.testnet). We keep our own copy so
 * both server and client code can reference them without importing the SDK.
 */

export const NETWORK = "testnet" as const;

export const FLOWVAULT = {
  contractAddress: "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD",
  contractName: "flowvault-v2",
  tokenContractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  tokenContractName: "usdcx",
} as const;

/** USDCx uses 6 decimals (tokenToMicro("1") === 1_000_000n). */
export const USDCX_DECIMALS = 6;

/**
 * Circle economics. Amounts are in whole USDCx (strings, for tokenToMicro()).
 * Kept intentionally small so a full 6-member / 6-round circle is cheap to run
 * for real on testnet — every transaction in the demo is genuine, not mocked.
 */
export const CIRCLE = {
  memberCount: 6,
  rounds: 6,
  /** Each member contributes this per round they are NOT the recipient. */
  contribution: "1",
  /** Commitment bond escrowed at join, locked until the circle completes. */
  bond: "1",
  /**
   * Blocks to lock the escrow bond for, measured from join time. Kept short so
   * the full lifecycle (join -> rounds -> complete -> bond return) can execute
   * with real txs inside a single demo sitting. Real ROSCAs would use months.
   */
  lockWindowBlocks: 30,
} as const;

/** Pot a recipient receives each round: everyone else contributes once. */
export const POT_PER_ROUND = CIRCLE.memberCount - 1;
