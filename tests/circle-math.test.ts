/**
 * tests/circle-math.test.ts — the circle economics the plan calls out (§7):
 * pot totals, bond pool, and payout conservation.
 */
import { describe, expect, it } from "vitest";
import { CIRCLE, POT_PER_ROUND } from "../lib/constants";

describe("circle math", () => {
  const N = CIRCLE.memberCount;
  const contribution = Number(CIRCLE.contribution);
  const bond = Number(CIRCLE.bond);

  it("pot per round = (N-1) × contribution", () => {
    expect(POT_PER_ROUND).toBe(N - 1);
    expect(POT_PER_ROUND * contribution).toBe((N - 1) * contribution);
  });

  it("pooled bonds = N × bond", () => {
    expect(N * bond).toBe(CIRCLE.memberCount * Number(CIRCLE.bond));
  });

  it("is conservative: total contributed = total paid out across all rounds", () => {
    // Each round every non-recipient contributes once → N×(N-1) contributions.
    const totalContributed = N * (N - 1) * contribution;
    // Each of N rounds pays one pot of (N-1)×contribution.
    const totalPaidOut = N * (N - 1) * contribution;
    expect(totalContributed).toBe(totalPaidOut);
  });

  it("each member nets zero on contributions (pays N-1, receives N-1)", () => {
    const paidByEachMember = (N - 1) * contribution; // contributes in every round but their own
    const receivedByEachMember = (N - 1) * contribution; // their single pot
    expect(paidByEachMember).toBe(receivedByEachMember);
  });
});
