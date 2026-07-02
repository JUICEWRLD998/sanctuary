/**
 * tests/circle-default.test.ts — Phase 2: prove the default → escrow
 * compensation path off-chain (implementation.md §3 step 5).
 *
 * Same approach as circle-engine.test.ts: mock the three network seams
 * (lib/flow, lib/members, lib/explorer) and run the REAL engine + REAL ledger.
 * A member misses a round; we assert the recipient is made whole from that
 * member's forfeited bond, and that the escrow's books still balance to zero
 * (Σ compensation + Σ bond-returns === pooled bonds).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CIRCLE } from "../lib/constants";

const chain = vi.hoisted(() => ({ block: 1000, txCounter: 0 }));

vi.mock("../lib/explorer", () => ({
  waitForTx: async () => "success",
  txUrl: (t: string) => `https://explorer/${t}`,
  addressUrl: (a: string) => `https://explorer/addr/${a}`,
  eventUrl: (e: { txid?: string }) => (e.txid ? `https://explorer/${e.txid}` : null),
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
import { complete, createCircle, join, runRound, runAllRounds } from "../lib/circle-engine";
import { deleteCircle, type CircleState } from "../lib/ledger";

const ID = "vitest-default";
const N = CIRCLE.memberCount;
const contribution = Number(CIRCLE.contribution);
const bond = Number(CIRCLE.bond);
const totalBonds = N * bond;

/** Sum the `amount` of every event of one kind. */
function sumAmount(state: CircleState, kind: string): number {
  return state.events
    .filter((e) => e.kind === kind)
    .reduce((acc, e) => acc + Number(e.amount ?? "0"), 0);
}

beforeEach(() => {
  chain.block = 1000;
  chain.txCounter = 0;
});
afterEach(async () => {
  await deleteCircle(ID);
});

describe("default → escrow compensation", () => {
  // Round 0's recipient is member 0, so member 1 is a valid non-recipient
  // defaulter for that round.
  const DEFAULTER = 1;
  const DEFAULT_ROUND = 0;

  it("records the miss during the round without moving the defaulter's funds", async () => {
    await createCircle(ID);
    await join(ID);
    const c = await runRound(ID, { defaults: { [DEFAULT_ROUND]: [DEFAULTER] } });

    const round = c.rounds[DEFAULT_ROUND];
    expect(round.defaulters).toEqual([DEFAULTER]);
    expect(round.shortfallUsdcx).toBe(String(contribution));
    // one fewer contribution than a clean round (N-1 → N-2), no defaulter tx
    expect(round.contributionTxids).toHaveLength(N - 2);

    const defaults = c.events.filter((e) => e.kind === "default");
    expect(defaults).toHaveLength(1);
    expect(defaults[0].actor).toBe(`SPMEMBER${DEFAULTER}`);
    expect(defaults[0].round).toBe(DEFAULT_ROUND);
    // the defaulter never appears as a contributor this round
    const contribs = c.events.filter((e) => e.kind === "contribution" && e.round === DEFAULT_ROUND);
    expect(contribs.some((e) => e.actor === `SPMEMBER${DEFAULTER}`)).toBe(false);
  });

  it("makes the shorted recipient whole and forfeits the defaulter's bond at completion", async () => {
    await createCircle(ID);
    await join(ID);
    await runRound(ID, { defaults: { [DEFAULT_ROUND]: [DEFAULTER] } });
    await runAllRounds(ID); // remaining rounds run clean

    chain.block = 99_999; // lock expired
    const c = await complete(ID);
    expect(c.phase).toBe("complete");

    // Compensation: exactly the shortfall, paid to round 0's recipient (member 0).
    const comp = c.events.filter((e) => e.kind === "compensation");
    expect(comp).toHaveLength(1);
    expect(comp[0].amount).toBe(String(contribution));
    expect(comp[0].recipient).toBe(`SPMEMBER${c.rounds[DEFAULT_ROUND].recipientId}`);
    expect(c.rounds[DEFAULT_ROUND].compensationTxids).toHaveLength(1);

    // Bond returns go to everyone EXCEPT the defaulter (who forfeited theirs).
    const returns = c.events.filter((e) => e.kind === "bond-return");
    expect(returns).toHaveLength(N - 1);
    expect(returns.some((e) => e.recipient === `SPMEMBER${DEFAULTER}`)).toBe(false);
    // …and the forfeit is recorded as a note.
    const forfeitNote = c.events.find(
      (e) => e.kind === "note" && e.recipient === `SPMEMBER${DEFAULTER}` && /forfeits/i.test(e.label)
    );
    expect(forfeitNote).toBeTruthy();
  });

  it("escrow books balance to zero: Σ compensation + Σ bond-returns === pooled bonds", async () => {
    await createCircle(ID);
    await join(ID);
    await runRound(ID, { defaults: { [DEFAULT_ROUND]: [DEFAULTER] } });
    await runAllRounds(ID);
    chain.block = 99_999;
    const c = await complete(ID);

    const paidOut = sumAmount(c, "compensation") + sumAmount(c, "bond-return");
    expect(paidOut).toBe(totalBonds); // escrow drains exactly the pool, no more
  });

  it("refuses a default that would exceed the defaulter's bond", async () => {
    // With bond === contribution, a member may miss at most one round.
    await createCircle(ID);
    await join(ID);
    await runRound(ID, { defaults: { 0: [DEFAULTER] } }); // round 0: member 1 defaults (ok)
    await runRound(ID); // round 1: member 1 is the recipient, runs clean
    // round 2: member 1 tries to default again → over-forfeits their bond.
    await expect(runRound(ID, { defaults: { 2: [DEFAULTER] } })).rejects.toThrow(/cannot default/i);
  });
});
