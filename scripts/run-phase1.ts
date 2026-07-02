/**
 * scripts/run-phase1.ts — drive the Phase 1 autopilot for real on testnet and
 * assert the result, producing the "full circle with real txids in the ledger"
 * that Phase 1's "Done when" requires.
 *
 * Run:  npm run phase1:run              (safe: refuses unless pre-flight is GO)
 *       npm run phase1:run -- --fresh   (reset the demo ledger first)
 *       npm run phase1:run -- --force   (broadcast even on a NO-GO pre-flight)
 *
 * It calls the SAME engine the orchestrator API exposes (lib/circle-engine
 * autopilot), with confirmation on, streaming every event as an explorer link.
 * Afterwards it re-loads the ledger and asserts the lifecycle invariants:
 *   • phase === "complete" (or "active"/"bonded" if the lock hasn't expired yet)
 *   • N bond SPLITs + 1 escrow LOCK
 *   • N × (N-1) contributions and N payouts
 *   • every recorded on-chain event carries a txid
 * then reads the escrow vault live to show the bond LOCK is genuinely on-chain.
 *
 * ⚠️ SIGNING PATH — testnet only. Uses the managed keys from .env.local.
 */
import { config as loadEnv } from "dotenv";
import { getAddressFromPrivateKey } from "@stacks/transactions";
import { tokenToMicro } from "flowvault-sdk";
import { NETWORK, FLOWVAULT, CIRCLE } from "../lib/constants";
import { HIRO_API, txUrl, addressUrl } from "../lib/explorer";
import { vaultFor, readState } from "../lib/flow";
import { autopilot } from "../lib/circle-engine";
import { deleteCircle, loadCircle, type LedgerEvent } from "../lib/ledger";
import { MEMBER_PROFILES } from "../lib/members";

loadEnv({ path: ".env.local" });

const ID = "demo";
const N = CIRCLE.memberCount;
const MIN_STX_MICRO = 1_000_000n;
const MEMBER_NEED_MICRO =
  tokenToMicro(CIRCLE.bond) + BigInt(N - 1) * tokenToMicro(CIRCLE.contribution);

const args = new Set(process.argv.slice(2));
const FRESH = args.has("--fresh");
const FORCE = args.has("--force");

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

/** Returns true when every member has gas + enough USDCx to complete a circle. */
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
  console.log(`🏛  Sanctuary — Phase 1 live autopilot, network: ${NETWORK}\n`);

  const go = await preflightGo();
  if (!go && !FORCE) {
    fail(
      "Pre-flight is NO-GO (missing STX gas and/or USDCx). Run `npm run verify:phase1` for\n" +
        "   the per-account breakdown, fund the shortfalls, then re-run. To broadcast anyway\n" +
        "   (will abort mid-run if funds are short), pass --force."
    );
  }
  if (!go) console.log("⚠  Pre-flight NO-GO but --force set: broadcasting; may abort mid-run.\n");

  if (FRESH) {
    await deleteCircle(ID);
    console.log(`🧹 Reset ledger for circle "${ID}".\n`);
  }

  console.log("🚀 Running autopilot (create → join → rounds → complete)…\n");
  const onEvent = (e: LedgerEvent) => {
    const link = e.txid ? `  ${txUrl(e.txid)}` : "";
    console.log(`   • [${e.kind}] ${e.label}${link}`);
  };

  await autopilot(ID, { confirm: true, onEvent });

  // ---- Assert lifecycle invariants against the persisted ledger ----
  const state = await loadCircle(ID);
  if (!state) fail("Autopilot produced no ledger — nothing persisted.");

  const count = (k: LedgerEvent["kind"]) => state!.events.filter((e) => e.kind === k).length;
  const bonds = count("bond");
  const locks = count("escrow-lock");
  const contributions = count("contribution");
  const payouts = count("payout");
  const returns = count("bond-return");
  const onChain = state!.events.filter((e) => e.txid);
  const missingTxid = state!.events.filter(
    (e) => e.txid === undefined && e.kind !== "payout" && e.kind !== "note"
  );

  console.log("\n📒 Ledger assertions");
  const checks: [string, boolean, string][] = [
    ["bond SPLITs", bonds === N, `${bonds}/${N}`],
    ["escrow LOCK", locks === 1, `${locks}/1`],
    ["contributions", contributions === N * (N - 1), `${contributions}/${N * (N - 1)}`],
    ["payouts", payouts === N, `${payouts}/${N}`],
    ["every money-move has a txid", missingTxid.length === 0, `${missingTxid.length} missing`],
    ["all rounds complete", state.rounds.every((r) => r.status === "complete"), ""],
  ];
  let allPass = true;
  for (const [label, pass, detail] of checks) {
    if (!pass) allPass = false;
    console.log(`   ${pass ? "✓" : "✗"} ${label}${detail ? ` (${detail})` : ""}`);
  }
  const completed = state.phase === "complete";
  console.log(
    `   ${completed ? "✓" : "◻"} phase = "${state.phase}"` +
      (completed ? "" : ` (bond-lock likely still active until block ${state.endBlock}; re-run to finish)`) +
      (completed ? ` · bond-returns ${returns}/${N}` : "")
  );

  // ---- Live, auditable escrow read: prove the LOCK is real on-chain ----
  const escrowKey = process.env.ESCROW_KEY!;
  const escrowAddr = getAddressFromPrivateKey(escrowKey, NETWORK);
  const escrowState = await readState(vaultFor(escrowKey), escrowAddr).catch(() => null);
  if (escrowState) {
    console.log(
      `\n🛡️  Escrow vault (live): total=${escrowState.total} locked=${escrowState.locked} ` +
        `unlocked=${escrowState.unlocked} · lockUntil=${escrowState.lockUntilBlock} ` +
        `(tip ${escrowState.currentBlock})`
    );
    console.log(`   ${addressUrl(escrowAddr)}`);
  }

  console.log(`\n🔗 ${onChain.length} on-chain txs recorded in the ledger (data/circles/${ID}.json).`);
  console.log(`   Recipients this circle: ${state.payoutOrder.map((i) => MEMBER_PROFILES[i].name).join(" → ")}`);

  if (allPass && completed) {
    console.log("\n✅ PHASE 1 VERIFIED — full circle executed on testnet with real txids.");
  } else if (allPass) {
    console.log("\n🟡 Rounds + bonds verified on-chain; completion pending lock expiry. Re-run to finish.");
    process.exitCode = 0;
  } else {
    fail("Ledger assertions failed — see the ✗ lines above.");
  }
}

main().catch((err) => {
  console.error("\n💥 phase1:run failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
