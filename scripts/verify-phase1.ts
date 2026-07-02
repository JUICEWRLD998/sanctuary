/**
 * scripts/verify-phase1.ts — read-only Phase 1 pre-flight for the testnet
 * autopilot.
 *
 * Run:  npm run verify:phase1
 *
 * It never signs or broadcasts anything. It:
 *   1. Derives all 7 managed addresses from .env.local (escrow + 6 members).
 *   2. Reads each account's STX (gas) and USDCx (wallet) balance, plus its
 *      FlowVault vault state (total / locked / unlocked).
 *   3. Computes the USDCx each member must hold in-wallet to drive a full
 *      autopilot lifecycle, and prints a clear GO / NO-GO with the exact
 *      shortfall per account.
 *
 * Funding model (why the numbers below):
 *   deposit() pulls USDCx from the signer's SIP-010 *wallet* balance; routed
 *   splits land in the *recipient's vault*, not their wallet. A member therefore
 *   cannot recycle a received pot into later contributions without withdrawing
 *   first, so each member must pre-hold, in-wallet:
 *       bond (1×) + contributions in every round but their own ((N-1)×)
 *   The escrow needs no starting USDCx: it locks the bonds it receives, and
 *   returns them from the same pool at completion.
 */
import { config as loadEnv } from "dotenv";
import { getAddressFromPrivateKey } from "@stacks/transactions";
import { tokenToMicro } from "flowvault-sdk";
import { NETWORK, FLOWVAULT, CIRCLE } from "../lib/constants";
import { HIRO_API, addressUrl } from "../lib/explorer";
import { vaultFor, readState } from "../lib/flow";
import { MEMBER_PROFILES, ESCROW_PROFILE } from "../lib/members";

loadEnv({ path: ".env.local" });

const MIN_STX_MICRO = 1_000_000n; // 1 STX, enough gas headroom for the run
const N = CIRCLE.memberCount;

/** In-wallet USDCx each member must hold: 1 bond + (N-1) contributions. */
const MEMBER_NEED_MICRO =
  tokenToMicro(CIRCLE.bond) + BigInt(N - 1) * tokenToMicro(CIRCLE.contribution);

type Role = { varName: string; label: string; emoji: string; isEscrow: boolean };

const ROLES: Role[] = [
  { varName: "ESCROW_KEY", label: ESCROW_PROFILE.name, emoji: ESCROW_PROFILE.emoji, isEscrow: true },
  ...MEMBER_PROFILES.map((m, i) => ({
    varName: `MEMBER_${i + 1}_KEY`,
    label: `${m.name} (${m.city})`,
    emoji: m.emoji,
    isEscrow: false,
  })),
];

async function stxMicro(address: string): Promise<bigint> {
  const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/stx`);
  if (!res.ok) return 0n;
  const data = (await res.json()) as { balance?: string };
  return BigInt(data.balance ?? "0");
}

async function usdcxWalletMicro(address: string): Promise<bigint> {
  const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/balances`);
  if (!res.ok) return 0n;
  const data = (await res.json()) as {
    fungible_tokens?: Record<string, { balance?: string }>;
  };
  const prefix = `${FLOWVAULT.tokenContractAddress}.${FLOWVAULT.tokenContractName}::`;
  for (const [assetId, info] of Object.entries(data.fungible_tokens ?? {})) {
    if (assetId.startsWith(prefix)) return BigInt(info.balance ?? "0");
  }
  return 0n;
}

const fmt = (micro: bigint) => (Number(micro) / 1_000_000).toString();

async function main() {
  console.log(`🏛  Sanctuary — Phase 1 pre-flight (read-only), network: ${NETWORK}\n`);
  console.log(
    `Circle: ${N} members · bond ${CIRCLE.bond} · contribution ${CIRCLE.contribution} ` +
      `· pot ${(N - 1) * Number(CIRCLE.contribution)}/round · lock ${CIRCLE.lockWindowBlocks} blocks`
  );
  console.log(`Each member must hold ${fmt(MEMBER_NEED_MICRO)} USDCx in-wallet to run a full circle.\n`);

  let stxBlocked = 0;
  let usdcxShort = 0;

  for (const role of ROLES) {
    const key = process.env[role.varName];
    if (!key) {
      console.log(`   ✗ ${role.label}: ${role.varName} missing from .env.local`);
      stxBlocked++;
      continue;
    }
    const address = getAddressFromPrivateKey(key, NETWORK);
    const [stx, usdcx, vault] = await Promise.all([
      stxMicro(address),
      usdcxWalletMicro(address),
      readState(vaultFor(key), address).catch(() => null),
    ]);

    const need = role.isEscrow ? 0n : MEMBER_NEED_MICRO;
    const stxOk = stx >= MIN_STX_MICRO;
    const usdcxOk = usdcx >= need;
    if (!stxOk) stxBlocked++;
    if (!usdcxOk) usdcxShort++;

    const vaultStr = vault
      ? `vault total=${vault.total} locked=${vault.locked} unlocked=${vault.unlocked}`
      : "vault=unreadable";

    console.log(`   ${role.emoji} ${role.label.padEnd(24)} ${address}`);
    console.log(
      `      STX ${stxOk ? "✓" : "✗"} ${fmt(stx).padEnd(10)} ` +
        `USDCx ${usdcxOk ? "✓" : "✗"} ${fmt(usdcx)}${role.isEscrow ? "" : `/${fmt(need)}`} ` +
        (usdcxOk ? "" : `(short ${fmt(need - usdcx)}) `) +
        `· ${vaultStr}`
    );
    console.log(`      ${addressUrl(address)}`);
  }

  console.log("\n────────────────────────────────────────────────────────");
  if (stxBlocked === 0 && usdcxShort === 0) {
    console.log("✅ GO — every account has gas and enough USDCx for a full autopilot run.");
    console.log("   Next: npm run phase1:run   (drives join → rounds → complete on testnet)");
  } else {
    console.log("⛔ NO-GO — the full lifecycle cannot complete yet:");
    if (stxBlocked > 0) console.log(`   • ${stxBlocked} account(s) need STX gas → npm run setup fund`);
    if (usdcxShort > 0)
      console.log(
        `   • ${usdcxShort} member(s) need more USDCx (fund in-wallet via the FlowVault dApp faucet ` +
          `or a SIP-010 transfer to the addresses above).`
      );
    console.log(
      "\n   Note: a partial run still proves the pipeline — join alone produces real\n" +
        "   bond-SPLIT + escrow-LOCK txids. Full completion needs the funding above."
    );
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error("\n💥 verify-phase1 failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
