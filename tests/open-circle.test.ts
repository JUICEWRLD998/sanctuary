/**
 * tests/open-circle.test.ts — verify the real-user ("open") circle engine
 * end-to-end WITHOUT touching the chain.
 *
 * We mock the network seams — lib/flow (broadcasts), lib/explorer (tx status),
 * lib/escrow-actor (the escrow signer) — and run the REAL open-circle engine +
 * REAL ledger. This proves create → members join → auto-form → rotate → complete
 * drives the state machine and records the ledger correctly, plus the join
 * guards (duplicate wallet, over-capacity, advance-before-full).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ESCROW_ADDRESS } from "../lib/constants";

const chain = vi.hoisted(() => ({ block: 1000, txCounter: 0 }));

vi.mock("../lib/explorer", () => ({
  waitForTx: async () => "success",
  getTxSender: async () => null, // sender check is skipped when null
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

vi.mock("../lib/escrow-actor", () => ({
  getEscrowActor: () => ({ address: ESCROW_ADDRESS, vault: {} }),
}));

// Import AFTER mocks are registered.
import {
  advanceOpenCircle,
  createOpenCircle,
  recordMember,
  upfrontTotal,
} from "../lib/open-circle";
import { deleteCircle } from "../lib/ledger";

const ID = "vitest-open";
const N = 3;
const CONTRIB = "1";
const BOND = "1";

/** Add a real member with skip-verify (no chain) — auto-forms on the last one. */
async function join(index: number) {
  return recordMember(
    {
      id: ID,
      address: `STMEMBER${index}`,
      name: `Member ${index}`,
      purpose: `Goal ${index}`,
      fundTxid: `fund-${index}`,
    },
    { confirm: false, skipChainVerify: true }
  );
}

beforeEach(async () => {
  chain.block = 1000;
  chain.txCounter = 0;
  await createOpenCircle({
    id: ID,
    title: "Test circle",
    capacity: N,
    contribution: CONTRIB,
    bond: BOND,
  });
});
afterEach(async () => {
  await deleteCircle(ID);
});

describe("open-circle lifecycle", () => {
  it("upfrontTotal = bond + (N-1)×contribution", () => {
    expect(upfrontTotal(N, CONTRIB, BOND)).toBe("3"); // 1 + 2×1
  });

  it("createOpenCircle seeds an empty lobby stamped with the escrow address", async () => {
    const c = await createOpenCircle({
      id: `${ID}-fresh`,
      title: "Fresh",
      capacity: N,
      contribution: CONTRIB,
      bond: BOND,
    });
    expect(c.phase).toBe("forming");
    expect(c.kind).toBe("open");
    expect(c.capacity).toBe(N);
    expect(c.members).toEqual([]);
    expect(c.rounds).toEqual([]);
    expect(c.escrow.address).toBe(ESCROW_ADDRESS);
    await deleteCircle(`${ID}-fresh`);
  });

  it("filling the roster auto-forms the circle and locks the bonds", async () => {
    await join(0);
    let c = await join(1);
    expect(c.phase).toBe("forming"); // not full yet
    c = await join(2); // last seat → auto-form

    expect(c.phase).toBe("active");
    expect(c.members).toHaveLength(N);
    expect(c.payoutOrder).toEqual([0, 1, 2]);
    expect(c.rounds).toHaveLength(N);
    expect(c.escrow.bondLockTxid).toBeTruthy();
    expect(c.createdBlock).toBe(1000);
    expect(c.endBlock).toBe(1030); // 1000 + lockWindowBlocks (30)

    const joins = c.events.filter((e) => e.kind === "member-join");
    const forms = c.events.filter((e) => e.kind === "circle-form");
    const locks = c.events.filter((e) => e.kind === "escrow-lock");
    expect(joins).toHaveLength(N);
    expect(joins.every((e) => e.txid)).toBe(true);
    expect(forms).toHaveLength(1);
    expect(locks).toHaveLength(1);
    expect(locks[0].amount).toBe(String(N * Number(BOND))); // pooled bonds
    for (const r of c.rounds) {
      expect(r.potUsdcx).toBe(String((N - 1) * Number(CONTRIB)));
    }
  });

  it("rejects a duplicate wallet and an over-capacity join", async () => {
    await join(0);
    // Same address again → rejected.
    await expect(
      recordMember(
        { id: ID, address: "STMEMBER0", name: "Dup", purpose: "x", fundTxid: "f" },
        { confirm: false, skipChainVerify: true }
      )
    ).rejects.toThrow(/already joined/i);

    // Fill it, then a further join is rejected (no longer forming).
    await join(1);
    await join(2);
    await expect(join(3)).rejects.toThrow(/no longer accepting|full/i);
  });

  it("advanceOpenCircle refuses before the circle is full", async () => {
    await join(0);
    await expect(advanceOpenCircle(ID, { confirm: false })).rejects.toThrow(/hasn't filled/i);
  });

  it("advance rotates the pot to each member, then returns every bond", async () => {
    await join(0);
    await join(1);
    await join(2); // auto-formed, phase active, endBlock 1030

    chain.block = 2000; // lock expired → completion allowed
    const c = await advanceOpenCircle(ID, { confirm: false });

    expect(c.phase).toBe("complete");
    expect(c.currentRound).toBe(N);

    // One escrow-signed payout per round, each carrying a txid, to each member once.
    const payouts = c.events.filter((e) => e.kind === "payout");
    expect(payouts).toHaveLength(N);
    expect(payouts.every((e) => e.txid)).toBe(true);
    expect(payouts.every((e) => e.amount === String((N - 1) * Number(CONTRIB)))).toBe(true);
    expect(new Set(payouts.map((e) => e.recipient)).size).toBe(N);

    // Every bond returned, one per member.
    const returns = c.events.filter((e) => e.kind === "bond-return");
    expect(returns).toHaveLength(N);
    expect(new Set(returns.map((e) => e.recipient)).size).toBe(N);
    expect(c.rounds.every((r) => r.status === "complete")).toBe(true);
  });
});
