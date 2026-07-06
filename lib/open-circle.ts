/**
 * lib/open-circle.ts — the real-user savings-circle engine ("open" circles).
 *
 * The demo engine (lib/circle-engine.ts) drives three server-held identities the
 * orchestrator signs for. This engine drives a circle of REAL wallets that join
 * a lobby themselves. See createcircle.md for the full plan.
 *
 * Model: "fund upfront, escrow auto-rotates" (the chosen design).
 *   join     → each member funds `bond + (N-1)×contribution` into the escrow in
 *              one wallet-signed move (client-side; the server only records the
 *              resulting txid after verifying it on-chain). We never hold a
 *              member's key.
 *   form     → once the roster fills, the escrow LOCKs the pooled bonds until
 *              `endBlock`; rotation begins. Payout order = join order.
 *   rotate   → each round the escrow SPLITs the pot `(N-1)×contribution` to that
 *              round's recipient. Because the escrow already holds every member's
 *              prepaid contributions, it signs this alone — the circle is
 *              genuinely self-driving, and no member can default mid-circle.
 *   complete → after lock expiry the escrow returns each member's bond in full.
 *
 * SERVER-ONLY — signs with the escrow key via lib/escrow-actor.
 */
import { CIRCLE } from "./constants";
import { getEscrowActor, type EscrowActor } from "./escrow-actor";
import { getTxSender, waitForTx } from "./explorer";
import {
  currentBlock,
  deposit,
  readState,
  setStrategy,
  withdraw,
  type Strategy,
} from "./flow";
import {
  appendEvent,
  loadCircle,
  saveCircle,
  type CircleMember,
  type CircleState,
  type LedgerEvent,
  type RoundRecord,
} from "./ledger";

export interface OpenRunOptions {
  /**
   * Wait for each broadcast tx to settle before firing the next dependent one.
   * Default `true` (required for real testnet correctness). Tests pass `false`.
   */
  confirm?: boolean;
  /** Optional hook fired after every recorded event (progress logging). */
  onEvent?: (event: LedgerEvent) => void;
  /**
   * Skip the on-chain verification of a member's funding tx (status + sender).
   * ONLY for tests that don't reach the network. Never set in production.
   */
  skipChainVerify?: boolean;
}

export interface CreateOpenParams {
  id: string;
  title: string;
  /** Target roster size; also the number of rounds and final memberCount. */
  capacity: number;
  /** Per-member per-round contribution, whole USDCx. */
  contribution: string;
  /** Commitment bond, whole USDCx (may be "0"). Locked for the circle, returned in full. */
  bond: string;
}

export interface JoinOpenParams {
  id: string;
  /** The joining wallet's Stacks address (its unique member id). */
  address: string;
  name: string;
  purpose: string;
  /** txid of the member's upfront funding deposit into the escrow. */
  fundTxid: string;
}

/** The full upfront amount a member funds at join: bond + all their contributions. */
export function upfrontTotal(capacity: number, contribution: string, bond: string): string {
  return String(Number(bond) + (capacity - 1) * Number(contribution));
}

/** Pot a recipient receives each round (whole USDCx, as a string). */
function potPerRound(state: CircleState): string {
  return String((state.memberCount - 1) * Number(state.contribution));
}

/** Total commitment bonds pooled in the escrow (whole USDCx, as a string). */
function totalBonds(state: CircleState): string {
  return String(state.memberCount * Number(state.bond));
}

/** Wait for a tx to reach a terminal state; throw if it did not succeed. */
async function confirm(txid: string): Promise<void> {
  const status = await waitForTx(txid);
  if (status !== "success") {
    throw new Error(`Transaction ${txid} did not confirm (status: ${status}).`);
  }
}

/**
 * Set a routing strategy, (optionally) wait for it, then deposit — so FlowVault
 * applies LOCK/SPLIT atomically on that deposit. Returns the deposit txid.
 */
async function routedDeposit(
  vault: EscrowActor["vault"],
  strategy: Strategy,
  amount: string,
  opts: OpenRunOptions
): Promise<string> {
  const strat = await setStrategy(vault, strategy);
  if (opts.confirm !== false) await confirm(strat.txid);
  const dep = await deposit(vault, amount);
  if (opts.confirm !== false) await confirm(dep.txid);
  return dep.txid;
}

/** Append an event and fire the progress hook. */
function record(state: CircleState, opts: OpenRunOptions, event: Omit<LedgerEvent, "at">): void {
  appendEvent(state, event);
  opts.onEvent?.(state.events[state.events.length - 1]);
}

/** Load an open circle by id or throw a clear error. */
async function requireOpen(id: string): Promise<CircleState> {
  const state = await loadCircle(id);
  if (!state) throw new Error(`Circle "${id}" not found.`);
  if (state.kind !== "open") {
    throw new Error(`Circle "${id}" is not an open (real-user) circle.`);
  }
  return state;
}

/**
 * Create an empty open circle in the lobby (`forming`) phase, ready for real
 * members to join. Ledger-only — no keys or chain access required.
 */
export async function createOpenCircle(p: CreateOpenParams): Promise<CircleState> {
  const capacity = Math.floor(p.capacity);
  if (capacity < 2) throw new Error("A circle needs at least 2 members.");
  if (capacity > 12) throw new Error("Keep circles to 12 members or fewer.");
  if (Number(p.contribution) <= 0) throw new Error("Contribution must be greater than 0.");
  if (Number(p.bond) < 0) throw new Error("Bond cannot be negative.");
  const title = p.title.trim();
  if (!title) throw new Error("A circle needs a name.");

  const state: CircleState = {
    id: p.id,
    phase: "forming",
    kind: "open",
    title,
    capacity,
    members: [],
    memberCount: capacity,
    contribution: p.contribution,
    bond: p.bond,
    payoutOrder: [], // assigned at form time (join order)
    currentRound: 0,
    createdBlock: null,
    endBlock: null,
    escrow: { address: null, bondLockTxid: null },
    rounds: [], // built at form time
    events: [],
    updatedAt: new Date().toISOString(),
  };
  return saveCircle(state);
}

/**
 * Verify a member's upfront funding tx really settled and was signed by the
 * joining wallet — so a member can't be recorded against a failed, unrelated, or
 * borrowed txid. Best-effort on the sender (the public API may lag); strict on
 * the settled status.
 */
async function verifyFunding(fundTxid: string, address: string): Promise<void> {
  const status = await waitForTx(fundTxid);
  if (status !== "success") {
    throw new Error(`Funding transaction did not confirm (status: ${status}).`);
  }
  const sender = await getTxSender(fundTxid);
  if (sender && sender !== address) {
    throw new Error(
      `Funding transaction was signed by ${sender}, not the joining wallet ${address}.`
    );
  }
}

/**
 * Record a real member who has funded their upfront deposit into the escrow.
 * Verifies the funding tx, guards against duplicates / overfilling, appends the
 * member, and — when the roster fills — automatically forms the circle and locks
 * the bonds.
 */
export async function recordMember(
  p: JoinOpenParams,
  opts: OpenRunOptions = {}
): Promise<CircleState> {
  const state = await requireOpen(p.id);
  if (state.phase !== "forming") {
    throw new Error("This circle has already filled and is no longer accepting members.");
  }

  const capacity = state.capacity ?? state.memberCount;
  const members = state.members ?? [];
  if (members.length >= capacity) throw new Error("This circle is already full.");
  if (members.some((m) => m.address === p.address)) {
    throw new Error("This wallet has already joined the circle.");
  }
  const name = p.name.trim();
  const purpose = p.purpose.trim();
  if (!name) throw new Error("Please enter your name.");
  if (!purpose) throw new Error("Please enter what you're saving for.");

  if (!opts.skipChainVerify) await verifyFunding(p.fundTxid, p.address);

  const member: CircleMember = {
    id: members.length,
    address: p.address,
    name,
    purpose,
    fundTxid: p.fundTxid,
    joinedAt: new Date().toISOString(),
  };
  members.push(member);
  state.members = members;

  record(state, opts, {
    kind: "member-join",
    label: `${name} joins the circle — funds ${upfrontTotal(
      capacity,
      state.contribution,
      state.bond
    )} USDCx upfront (bond + contributions)`,
    actor: p.address,
    amount: upfrontTotal(capacity, state.contribution, state.bond),
    txid: p.fundTxid,
  });
  await saveCircle(state);

  // Full house → form the circle and begin rotation.
  if (members.length === capacity) {
    return form(state, opts);
  }
  return state;
}

/**
 * Once the roster is full: lock the pooled bonds in the escrow until `endBlock`,
 * set the payout order (join order), build the rounds, and move to `active`.
 */
async function form(state: CircleState, opts: OpenRunOptions): Promise<CircleState> {
  const escrow = getEscrowActor();
  state.escrow.address = escrow.address;

  const tip = await currentBlock(escrow.vault, escrow.address);
  const endBlock = tip + CIRCLE.lockWindowBlocks;
  state.createdBlock = tip;
  state.endBlock = endBlock;

  const members = state.members ?? [];
  state.payoutOrder = members.map((m) => m.id);
  state.rounds = state.payoutOrder.map((recipientId, index) => ({
    index,
    recipientId,
    status: "pending" as const,
    contributionTxids: [],
    potUsdcx: potPerRound(state),
    defaulters: [],
    shortfallUsdcx: "0",
    compensationTxids: [],
  })) satisfies RoundRecord[];

  record(state, opts, {
    kind: "circle-form",
    label: `Circle is full (${members.length} members) — bonds lock and rotation begins`,
    actor: escrow.address,
  });

  // Lock the pooled bonds (the commitment anchor) until the circle ends.
  if (Number(totalBonds(state)) > 0) {
    const lockTxid = await routedDeposit(
      escrow.vault,
      { lock: totalBonds(state), lockUntilBlock: endBlock, splitAddress: null, split: "0" },
      totalBonds(state),
      opts
    );
    state.escrow.bondLockTxid = lockTxid;
    record(state, opts, {
      kind: "escrow-lock",
      label: `Escrow locks ${totalBonds(state)} USDCx of bonds until block ${endBlock}`,
      actor: escrow.address,
      amount: totalBonds(state),
      txid: lockTxid,
    });
  }

  state.phase = "active";
  return saveCircle(state);
}

/** Run one round: the escrow SPLITs the whole pot to that round's recipient. */
async function runOpenRound(state: CircleState, opts: OpenRunOptions): Promise<CircleState> {
  const escrow = getEscrowActor();
  const r = state.currentRound;
  const round = state.rounds[r];
  const members = state.members ?? [];
  const recipient = members[round.recipientId];

  round.status = "running";
  await saveCircle(state);

  const pot = round.potUsdcx;
  const txid = await routedDeposit(
    escrow.vault,
    { splitAddress: recipient.address, split: pot, lock: "0" },
    pot,
    opts
  );
  round.contributionTxids.push(txid);
  round.status = "complete";
  record(state, opts, {
    kind: "payout",
    label: `${recipient.name} receives the round ${r + 1} pot: ${pot} USDCx`,
    round: r,
    recipient: recipient.address,
    amount: pot,
    txid,
  });

  state.currentRound = r + 1;
  return saveCircle(state);
}

/**
 * After the last round and lock expiry: reclaim the pooled bonds and return each
 * member's bond in full. No defaults are possible (contributions were prepaid),
 * so every member gets their whole bond back.
 */
async function completeOpen(state: CircleState, opts: OpenRunOptions): Promise<CircleState> {
  if (state.currentRound < state.rounds.length) {
    throw new Error("Cannot complete: not all rounds have run yet.");
  }
  if (state.phase === "complete") return state;

  const escrow = getEscrowActor();
  const members = state.members ?? [];

  if (Number(totalBonds(state)) > 0) {
    const tip = await currentBlock(escrow.vault, escrow.address);
    if (state.endBlock !== null && tip < state.endBlock) {
      const remaining = state.endBlock - tip;
      throw new Error(
        `Escrow bond-lock still active: ${remaining} block(s) until ${state.endBlock} ` +
          `(current ${tip}). Wait for expiry, then complete.`
      );
    }

    // Reclaim the now-unlocked bonds from the escrow vault to its wallet…
    const reclaim = await withdraw(escrow.vault, totalBonds(state));
    if (opts.confirm !== false) await confirm(reclaim.txid);
    record(state, opts, {
      kind: "note",
      label: `Escrow reclaims ${totalBonds(state)} USDCx (lock expired)`,
      actor: escrow.address,
      amount: totalBonds(state),
      txid: reclaim.txid,
    });
    await saveCircle(state);

    // …then return each member's bond in full to their own wallet.
    for (const member of members) {
      const txid = await routedDeposit(
        escrow.vault,
        { splitAddress: member.address, split: state.bond, lock: "0" },
        state.bond,
        opts
      );
      record(state, opts, {
        kind: "bond-return",
        label: `Escrow returns ${member.name}'s ${state.bond} USDCx bond`,
        actor: escrow.address,
        recipient: member.address,
        amount: state.bond,
        txid,
      });
      await saveCircle(state);
    }
  }

  // Snapshot the escrow's final state so the read API renders this circle's OWN
  // numbers rather than a live read of the shared escrow principal.
  try {
    const s = await readState(escrow.vault, escrow.address);
    state.escrow.snapshot = { ...s, at: new Date().toISOString() };
  } catch {
    /* non-fatal — API falls back to a live read if no snapshot is stored */
  }

  state.phase = "complete";
  return saveCircle(state);
}

/**
 * Drive a formed open circle to done: run every remaining round, then complete
 * once the lock has expired. Signs with the escrow key only. The "run it" button
 * on a full circle calls this.
 */
export async function advanceOpenCircle(
  id: string,
  opts: OpenRunOptions = {}
): Promise<CircleState> {
  let state = await requireOpen(id);
  if (state.phase === "forming") {
    throw new Error("This circle hasn't filled yet — it can't run until every seat is taken.");
  }

  while (state.currentRound < state.rounds.length) {
    state = await runOpenRound(state, opts);
  }

  if (state.phase !== "complete") {
    // Completion depends on lock expiry; surface the wait as an error to the caller.
    const escrow = getEscrowActor();
    const tip = await currentBlock(escrow.vault, escrow.address);
    if (state.endBlock === null || tip >= state.endBlock || Number(totalBonds(state)) === 0) {
      state = await completeOpen(state, opts);
    }
  }

  return state;
}
