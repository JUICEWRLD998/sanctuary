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

/**
 * The app-run escrow principal's PUBLIC Stacks address. Public and stable (it is
 * the same principal shown in the demo ledgers and README), so open circles can
 * stamp it at creation — members need somewhere to send their upfront funds
 * before the circle fills. The server derives the same address from ESCROW_KEY
 * for signing (lib/escrow-actor); the key must correspond to this address.
 */
export const ESCROW_ADDRESS = "ST3BBEF5Q148CCEZ14Y0EJDTRAHWMKDEQTJVZ15CT";

/** USDCx uses 6 decimals (tokenToMicro("1") === 1_000_000n). */
export const USDCX_DECIMALS = 6;

/**
 * Circle economics. Amounts are in whole USDCx (strings, for tokenToMicro()).
 * Kept intentionally small so a full 6-member / 6-round circle is cheap to run
 * for real on testnet — every transaction in the demo is genuine, not mocked.
 */
export const CIRCLE = {
  // Scoped to the 3 testnet wallets that are actually USDCx-funded (Amara,
  // Chidi, Fatima = MEMBER_1/2/3_KEY). A 3-member circle completes a full,
  // real on-chain lifecycle within existing funds; bump both back to 6 if the
  // remaining three wallets (Marco/Priya/Kwame) ever get USDCx + STX gas.
  memberCount: 3,
  rounds: 3,
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
