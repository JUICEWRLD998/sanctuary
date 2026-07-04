/**
 * scripts/seed-live.ts — seed a real, MID-FLIGHT circle on testnet so judges see
 * both settled history AND a live in-progress round (implementation.md §6).
 *
 * Unlike `phase1:run` (which drives a circle to completion), this stops after
 * the first round: bonds SPLIT → escrow LOCK → round 1 pays Amara → HALT with
 * rounds 2–3 still pending. The circle is left `phase: "active"`, so its page
 * shows a genuine live round and the escrow genuinely holds the locked bonds.
 *
 * Uses a distinct ledger id ("live") — it never touches the completed `demo`
 * circle. Because the escrow is a single shared principal, only ONE circle can
 * legitimately hold escrow funds at a time; the completed `demo`/`default-demo`
 * circles now render their captured drained snapshot instead of a live read
 * (see lib/circle-engine complete() + app/api/circle), so this live circle's
 * locked bonds don't leak onto them.
 *
 * Run:  npm run seed:live               (refuses if "live" already has on-chain state)
 *       npm run seed:live -- --fresh    (delete the local ledger first — see warning)
 *
 * ⚠️ SIGNING PATH — testnet only. Uses the managed keys from .env.local.
 * ⚠️ The escrow will hold the pooled bonds LOCKed until the lock expires; run a
 *    completion later (or leave it live for the demo) to drain the escrow to 0.
 */
import { config as loadEnv } from "dotenv";
import { getAddressFromPrivateKey } from "@stacks/transactions";
import { tokenToMicro } from "flowvault-sdk";
import { NETWORK, FLOWVAULT, CIRCLE } from "../lib/constants";
import { HIRO_API, eventUrl, addressUrl } from "../lib/explorer";
import { vaultFor, readState } from "../lib/flow";
import { createCircle, join, runRound } from "../lib/circle-engine";
import { deleteCircle, loadCircle, type LedgerEvent } from "../lib/ledger";
import { MEMBER_PROFILES } from "../lib/members";

loadEnv({ path: ".env.local" });

const ID = "live";
const N = CIRCLE.memberCount;
const MIN_STX_MICRO = 1_000_000n;
// A member's worst-case outlay through round 1: bond + one contribution.
const MEMBER_NEED_MICRO = tokenToMicro(CIRCLE.bond) + tokenToMicro(CIRCLE.contribution);

const args = new Set(process.argv.slice(2));
const FRESH = args.has("--fresh");

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

/** Every member has gas + enough USDCx to bond and fund round 1. */
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
  console.log(`🏛  Sanctuary — seed a live (mid-flight) circle "${ID}", network: ${NETWORK}\n`);

  // Guard against double-spend: if a live circle already broadcast bonds, a
  // re-run would orphan those on-chain funds. Require an explicit --fresh.
  const existing = await loadCircle(ID);
  if (existing && existing.phase !== "forming" && !FRESH) {
    fail(
      `Circle "${ID}" already exists in phase "${existing.phase}" with on-chain state.\n` +
        `   Re-running would broadcast a SECOND set of bonds. If you really want to reset the\n` +
        `   local ledger and seed again, pass --fresh — but note any bonds already LOCKed in\n` +
        `   the escrow from the previous run will be orphaned (complete it first to reclaim).`
    );
  }

  if (!(await preflightGo())) {
    fail(
      "Pre-flight NO-GO: a managed member is missing STX gas and/or the USDCx needed to bond +\n" +
        "   fund round 1. Run `npm run verify:phase1` for the per-account breakdown, then re-fund."
    );
  }

  if (FRESH && existing) {
    await deleteCircle(ID);
    console.log(`🧹 Reset local ledger for circle "${ID}".\n`);
  }

  const onEvent = (e: LedgerEvent) => {
    const url = eventUrl(e);
    console.log(`   • [${e.kind}] ${e.label}${url ? `  ${url}` : ""}`);
  };

  console.log("🚀 create → join (bonds → escrow LOCK) → round 1 (pot → first recipient)…\n");
  await createCircle(ID);
  await join(ID, { confirm: true, onEvent });
  await runRound(ID, { confirm: true, onEvent });

  // ---- Assert the mid-flight invariants ----
  const state = await loadCircle(ID);
  if (!state) fail("No ledger persisted — nothing seeded.");

  const count = (k: LedgerEvent["kind"]) => state!.events.filter((e) => e.kind === k).length;
  const bonds = count("bond");
  const locks = count("escrow-lock");
  const contributions = count("contribution");
  const payouts = count("payout");
  const round0 = state!.rounds[0];

  console.log("\n📒 Live-circle assertions");
  const checks: [string, boolean, string][] = [
    ["phase is active (mid-flight)", state.phase === "active", `"${state.phase}"`],
    ["one round settled, rounds remain", state.currentRound === 1 && state.rounds.length > 1, `${state.currentRound}/${state.rounds.length}`],
    ["bond SPLITs", bonds === N, `${bonds}/${N}`],
    ["escrow LOCK", locks === 1, `${locks}/1`],
    ["round-1 contributions", contributions === N - 1, `${contributions}/${N - 1}`],
    ["round-1 payout recorded", payouts === 1, `${payouts}/1`],
    ["round 1 complete", round0?.status === "complete", round0?.status ?? "—"],
    ["rounds 2+ still pending", state.rounds.slice(1).every((r) => r.status === "pending"), ""],
    ["every money-move has a txid", state.events.filter((e) => e.txid === undefined && e.kind !== "payout" && e.kind !== "note").length === 0, ""],
  ];
  let allPass = true;
  for (const [label, pass, detail] of checks) {
    if (!pass) allPass = false;
    console.log(`   ${pass ? "✓" : "✗"} ${label}${detail ? ` (${detail})` : ""}`);
  }

  // ---- Live escrow read: prove the bonds are genuinely LOCKed right now ----
  const escrowKey = process.env.ESCROW_KEY!;
  const escrowAddr = getAddressFromPrivateKey(escrowKey, NETWORK);
  const escrowState = await readState(vaultFor(escrowKey), escrowAddr).catch(() => null);
  if (escrowState) {
    console.log(
      `\n🛡️  Escrow vault (live): total=${escrowState.total} locked=${escrowState.locked} ` +
        `unlocked=${escrowState.unlocked} · lockUntil=${escrowState.lockUntilBlock} (tip ${escrowState.currentBlock})`
    );
    console.log(`   ${addressUrl(escrowAddr)}`);
  }

  const nextRecipient = MEMBER_PROFILES[state.payoutOrder[state.currentRound]]?.name ?? "—";
  console.log(
    `\n🔗 Recipients: ${state.payoutOrder.map((i) => MEMBER_PROFILES[i].name).join(" → ")}` +
      `  ·  next up: ${nextRecipient} (round ${state.currentRound + 1})`
  );
  console.log(`👀 View it at /circle/${ID} — history + a live in-progress round.`);

  if (allPass) {
    console.log(`\n✅ Seeded a live mid-flight circle "${ID}" on testnet.`);
  } else {
    fail("Assertions failed — see the ✗ lines above.");
  }
}

main().catch((err) => {
  console.error("\n💥 seed:live failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
