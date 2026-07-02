/**
 * tests/circle-engine.test.ts — verify the Phase 1 orchestration logic
 * end-to-end WITHOUT touching the chain.
 *
 * We mock the three seams that reach the network — lib/flow (broadcasts),
 * lib/members (signing actors + block height), lib/explorer (tx confirmation) —
 * and run the REAL circle-engine + REAL ledger (JSON persistence). This proves
 * join → all rounds → complete drives the state machine and records the ledger
 * correctly, so the on-chain autopilot only has to add real txids.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CIRCLE } from "../lib/constants";

// Shared, hoisted mutable state the mock factories can close over.
const chain = vi.hoisted(() => ({ block: 1000, txCounter: 0 }));

vi.mock("../lib/explorer", () => ({
  waitForTx: async () => "success",
  txUrl: (t: string) => `https://explorer/${t}`,
  addressUrl: (a: string) => `https://explorer/addr/${a}`,
}));

vi.mock("../lib/flow", () => ({
  currentBlock: async () => chain.block,
  setStrategy: async () => ({ txid: `strat-${chain.txCounter++}` }),
  deposit: async () => ({ txid: `dep-${chain.txCounter++}` }),
  withdraw: async () => ({ txid: `wd-${chain.txCounter++}` }),
  readState: async (_v: unknown, address: string) => ({
    address,
    total: "0",
    locked: "0",
    unlocked: "0",
    lockUntilBlock: 0,
    currentBlock: chain.block,
  }),
}));

vi.mock("../lib/members", () => {
  const mkVault = () => ({ getCurrentBlockHeight: async () => chain.block });
  const members = Array.from({ length: CIRCLE.memberCount }, (_, i) => ({
    id: i,
    name: `M${i}`,
    city: "",
    reason: "",
    emoji: "",
    address: `SPMEMBER${i}`,
    vault: mkVault(),
  }));
  const escrow = { name: "Escrow", emoji: "", address: "SPESCROW", vault: mkVault() };
  return {
    getCircleActors: () => ({ escrow, members }),
    getMembers: () => members,
    getEscrow: () => escrow,
    MEMBER_PROFILES: members,
    ESCROW_PROFILE: { name: "Escrow", emoji: "" },
  };
});

// Import AFTER mocks are registered.
import {
  autopilot,
  complete,
  createCircle,
  join,
  runAllRounds,
} from "../lib/circle-engine";
import { deleteCircle, loadCircle } from "../lib/ledger";

const ID = "vitest-circle";
const N = CIRCLE.memberCount;
const nonRecipients = N - 1;

beforeEach(() => {
  chain.block = 1000;
  chain.txCounter = 0;
});
afterEach(async () => {
  await deleteCircle(ID);
});

describe("circle-engine lifecycle", () => {
  it("createCircle seeds N pending rounds with the correct pot", async () => {
    const c = await createCircle(ID);
    expect(c.phase).toBe("forming");
    expect(c.rounds).toHaveLength(N);
    expect(c.payoutOrder).toEqual(Array.from({ length: N }, (_, i) => i));
    // pot = (N-1) × contribution
    for (const r of c.rounds) {
      expect(r.potUsdcx).toBe(String(nonRecipients * Number(CIRCLE.contribution)));
      expect(r.status).toBe("pending");
    }
  });

  it("join: every member bonds to escrow, then escrow locks the pool", async () => {
    await createCircle(ID);
    const c = await join(ID);

    expect(c.phase).toBe("bonded");
    expect(c.escrow.address).toBe("SPESCROW");
    expect(c.escrow.bondLockTxid).toBeTruthy();
    expect(c.createdBlock).toBe(1000);
    expect(c.endBlock).toBe(1000 + CIRCLE.lockWindowBlocks);

    const bondEvents = c.events.filter((e) => e.kind === "bond");
    const lockEvents = c.events.filter((e) => e.kind === "escrow-lock");
    expect(bondEvents).toHaveLength(N); // one bond per member
    expect(lockEvents).toHaveLength(1); // one pooled lock
    expect(bondEvents.every((e) => e.txid && e.recipient === "SPESCROW")).toBe(true);
    expect(lockEvents[0].amount).toBe(String(N * Number(CIRCLE.bond)));
  });

  it("runAllRounds: each round pays (N-1) contributions to the rotating recipient", async () => {
    await createCircle(ID);
    await join(ID);
    const c = await runAllRounds(ID);

    expect(c.currentRound).toBe(N);
    expect(c.rounds.every((r) => r.status === "complete")).toBe(true);

    for (let r = 0; r < N; r++) {
      const round = c.rounds[r];
      const recipient = `SPMEMBER${c.payoutOrder[r]}`;
      const contribs = c.events.filter((e) => e.kind === "contribution" && e.round === r);
      // exactly N-1 contributions, none from the recipient, all to the recipient
      expect(round.contributionTxids).toHaveLength(nonRecipients);
      expect(contribs).toHaveLength(nonRecipients);
      expect(contribs.every((e) => e.recipient === recipient)).toBe(true);
      expect(contribs.some((e) => e.actor === recipient)).toBe(false);
    }

    // total contributions across the whole circle = N × (N-1)
    const allContribs = c.events.filter((e) => e.kind === "contribution");
    expect(allContribs).toHaveLength(N * nonRecipients);
    // each member receives the pot exactly once
    const payouts = c.events.filter((e) => e.kind === "payout");
    expect(payouts).toHaveLength(N);
  });

  it("complete: refuses while the bond-lock is active, then returns every bond", async () => {
    await createCircle(ID);
    await join(ID);
    await runAllRounds(ID);

    // Lock still active (current block < endBlock) → must refuse.
    chain.block = 1005;
    await expect(complete(ID)).rejects.toThrow(/lock still active/i);

    // Advance past expiry → completes and returns all bonds.
    chain.block = 2000;
    const c = await complete(ID);
    expect(c.phase).toBe("complete");
    const returns = c.events.filter((e) => e.kind === "bond-return");
    expect(returns).toHaveLength(N);
    expect(new Set(returns.map((e) => e.recipient)).size).toBe(N); // one per member
  });

  it("autopilot: drives create → join → rounds → complete in one call", async () => {
    chain.block = 500; // so endBlock (530) is passed by the time we complete
    // createCircle at block 500 → endBlock 530; bump block before completion check
    const first = await createCircle(ID);
    expect(first.phase).toBe("forming");

    chain.block = 500;
    await join(ID);
    await runAllRounds(ID);
    chain.block = 9999; // lock expired
    const c = await autopilot(ID);

    expect(c.phase).toBe("complete");
    expect(c.currentRound).toBe(N);
  });
});
