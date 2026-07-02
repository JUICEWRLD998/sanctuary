/**
 * scripts/simulate-default.ts — Phase 2's on-chain "Done when": run a circle in
 * which one member DEFAULTS on a round, and prove the escrow makes the shorted
 * recipient whole from that member's forfeited bond — all with real testnet txs.
 *
 * Run:  npm run phase2:default            (safe: refuses unless pre-flight is GO)
 *       npm run phase2:default -- --force (broadcast even on a NO-GO pre-flight)
 *
 * ⚠️ SIGNING PATH — testnet only. Uses the managed keys from .env.local, and
 * SPENDS real testnet USDCx/STX. It always runs on a throwaway circle id
 * ("default-demo") so it never clobbers the pristine `demo` circle used for the
 * happy-path submission asset.
 *
 * Flow (see implementation.md §3 step 5):
 *   create → join → runRound[0] with member 1 defaulting → remaining rounds
 *   → complete (compensation + selective bond return, after lock expiry)
 *
 * Assertions against the persisted ledger + a live escrow read:
 *   • the defaulted round records exactly one `default` and one fewer contribution
 *   • completion emits a `compensation` SPLIT equal to the shortfall, to the
 *     shorted recipient, with a real txid
 *   • the defaulter receives no bond-return; everyone else does
 *   • escrow books balance: Σ compensation + Σ bond-returns === pooled bonds
 */
import { config as loadEnv } from "dotenv";
import { getAddressFromPrivateKey } from "@stacks/transactions";
import { tokenToMicro } from "flowvault-sdk";
import { NETWORK, FLOWVAULT, CIRCLE } from "../lib/constants";
import { HIRO_API, eventUrl, addressUrl } from "../lib/explorer";
import { vaultFor, readState } from "../lib/flow";
import { complete, createCircle, join, runAllRounds, runRound } from "../lib/circle-engine";
import { deleteCircle, loadCircle, type LedgerEvent } from "../lib/ledger";
import { MEMBER_PROFILES } from "../lib/members";

loadEnv({ path: ".env.local" });

const ID = "default-demo";
const N = CIRCLE.memberCount;
/** Member 1 defaults on round 0 (whose recipient is member 0 → a valid miss). */
const DEFAULT_ROUND = 0;
const DEFAULTER = 1;

const MIN_STX_MICRO = 1_000_000n;
const MEMBER_NEED_MICRO =
  tokenToMicro(CIRCLE.bond) + BigInt(N - 1) * tokenToMicro(CIRCLE.contribution);

const FORCE = new Set(process.argv.slice(2)).has("--force");

async function stxMicro(address: string): Promise<bigint> {
  const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/stx`);
  if (!res.ok) return 0n;
  return BigInt(((await res.json()) as { balance?: string }).balance ?? "0");
}

async function usdcxWalletMicro(address: string): Promise<bigint> {
  const res = await fetch(`${HIRO_API}/extended/v1/address/${address}/balances`);
  if (!res.ok) return 0n;
  const data = (await res.json()) as { fungible_tokens?: Record<string, { balance?: string }> };
  const prefix = `${FLOWVAULT.tokenContractAddress}.${FLOWVAULT.tokenContractName}::`;
  for (const [assetId, info] of Object.entries(data.fungible_tokens ?? {})) {
    if (assetId.startsWith(prefix)) return BigInt(info.balance ?? "0");
  }
  return 0n;
}

/** True when every member has gas + enough USDCx (a defaulter needs no more). */
async function preflightGo(): Promise<boolean> {
  let ok = true;
  for (let i = 0; i < N; i++) {
    const key = process.env[`MEMBER_${i + 1}_KEY`];
    if (!key) return false;
    const address = getAddressFromPrivateKey(key, NETWORK);
    const [stx, usdcx] = await Promise.all([stxMicro(address), usdcxWalletMicro(address)]);
    if (stx < MIN_STX_MICRO || usdcx < MEMBER_NEED_MICRO) ok = false;
  }
  const escrowKey = process.env.ESCROW_KEY;
  if (!escrowKey) return false;
  if ((await stxMicro(getAddressFromPrivateKey(escrowKey, NETWORK))) < MIN_STX_MICRO) ok = false;
  return ok;
}

function fail(msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

async function main() {
  console.log(`🏛  Sanctuary — Phase 2 default-compensation sim, network: ${NETWORK}\n`);

  const go = await preflightGo();
  if (!go && !FORCE) {
    fail(
      "Pre-flight is NO-GO (missing STX gas and/or USDCx). Run `npm run verify:phase1` for the\n" +
        "   per-account breakdown, fund the shortfalls, then re-run. To broadcast anyway, pass --force."
    );
  }
  if (!go) console.log("⚠  Pre-flight NO-GO but --force set: broadcasting; may abort mid-run.\n");

  // Always start from a clean throwaway circle so `demo` is never touched.
  await deleteCircle(ID);

  const defaulterName = MEMBER_PROFILES[DEFAULTER].name;
  const opts = {
    confirm: true as const,
    defaults: { [DEFAULT_ROUND]: [DEFAULTER] },
    onEvent: (e: LedgerEvent) => {
      const url = eventUrl(e);
      console.log(`   • [${e.kind}] ${e.label}${url ? `  ${url}` : ""}`);
    },
  };

  console.log(
    `🚀 Running circle "${ID}" with ${defaulterName} defaulting on round ${DEFAULT_ROUND + 1}…\n`
  );
  await createCircle(ID);
  await join(ID, opts);
  await runRound(ID, opts); // round 0 — DEFAULTER misses
  await runAllRounds(ID, opts); // remaining rounds run clean

  // Completion (compensation + bond return) needs the bond-lock to have expired.
  const state0 = await loadCircle(ID);
  if (state0?.endBlock != null) {
    const { getEscrow } = await import("../lib/members");
    const { currentBlock } = await import("../lib/flow");
    const escrow = getEscrow();
    let tip = await currentBlock(escrow.vault, escrow.address);
    while (tip < state0.endBlock) {
      const remaining = state0.endBlock - tip;
      console.log(`\n⏳ Bond-lock active: ${remaining} block(s) to ${state0.endBlock} (tip ${tip}). Waiting…`);
      await new Promise((r) => setTimeout(r, 30_000));
      tip = await currentBlock(escrow.vault, escrow.address);
    }
  }
  console.log("\n🔓 Lock expired — completing (compensation + bond return)…\n");
  await complete(ID, opts);

  // ---- Assert the default/compensation invariants ----
  const state = await loadCircle(ID);
  if (!state) fail("Sim produced no ledger — nothing persisted.");

  const round = state!.rounds[DEFAULT_ROUND];
  const defaults = state!.events.filter((e) => e.kind === "default");
  const comp = state!.events.filter((e) => e.kind === "compensation");
  const returns = state!.events.filter((e) => e.kind === "bond-return");
  const defaulterAddr = getAddressFromPrivateKey(process.env[`MEMBER_${DEFAULTER + 1}_KEY`]!, NETWORK);

  const sum = (kind: LedgerEvent["kind"]) =>
    state!.events.filter((e) => e.kind === kind).reduce((a, e) => a + Number(e.amount ?? "0"), 0);
  const booksBalance = sum("compensation") + sum("bond-return");
  const pooledBonds = N * Number(CIRCLE.bond);

  console.log("\n📒 Default/compensation assertions");
  const checks: [string, boolean, string][] = [
    ["one default recorded", defaults.length === 1, `${defaults.length}/1`],
    ["defaulted round short one contribution", round.contributionTxids.length === N - 2, `${round.contributionTxids.length}/${N - 2}`],
    ["shortfall recorded", round.shortfallUsdcx === CIRCLE.contribution, round.shortfallUsdcx],
    ["compensation SPLIT paid", comp.length === 1 && comp[0].amount === CIRCLE.contribution, `${comp.length}/1`],
    ["compensation has a txid", comp.length === 1 && Boolean(comp[0].txid), comp[0]?.txid ? "yes" : "no"],
    ["defaulter got no bond-return", returns.every((e) => e.recipient !== defaulterAddr), ""],
    ["other bonds returned", returns.length === N - 1, `${returns.length}/${N - 1}`],
    ["escrow books balance to zero", booksBalance === pooledBonds, `${booksBalance}/${pooledBonds}`],
    ["phase complete", state!.phase === "complete", state!.phase],
  ];
  let allPass = true;
  for (const [label, pass, detail] of checks) {
    if (!pass) allPass = false;
    console.log(`   ${pass ? "✓" : "✗"} ${label}${detail ? ` (${detail})` : ""}`);
  }

  // ---- Live escrow read: prove it drained to zero on-chain ----
  const escrowKey = process.env.ESCROW_KEY!;
  const escrowAddr = getAddressFromPrivateKey(escrowKey, NETWORK);
  const escrowState = await readState(vaultFor(escrowKey), escrowAddr).catch(() => null);
  if (escrowState) {
    console.log(
      `\n🛡️  Escrow vault (live): total=${escrowState.total} locked=${escrowState.locked} ` +
        `unlocked=${escrowState.unlocked}`
    );
    console.log(`   ${addressUrl(escrowAddr)}`);
  }

  if (allPass) {
    console.log("\n✅ PHASE 2 VERIFIED — a simulated default was compensated on-chain from the forfeited bond.");
  } else {
    fail("Assertions failed — see the ✗ lines above.");
  }
}

main().catch((err) => {
  console.error("\n💥 phase2:default failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
