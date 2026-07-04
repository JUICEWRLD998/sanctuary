/**
 * lib/circle-engine.ts — the rotating savings-circle state machine.
 *
 * This is Sanctuary's technical centrepiece and its reusable ecosystem
 * contribution (implementation.md §4): a documented TypeScript layer over
 * `flowvault-sdk` that composes the three FlowVault primitives — LOCK, SPLIT,
 * HOLD — into a self-driving ROSCA that anyone can fork.
 *
 * Lifecycle
 *   createCircle → join → (runRound × N) → complete
 *
 * Primitive mapping (see implementation.md §3)
 *   join      → each member SPLITs a bond into the escrow principal
 *   join      → escrow LOCKs the pooled bonds until `endBlock`
 *   runRound  → every non-recipient member SPLITs their contribution to the
 *               round's recipient; recipient receives (N-1) × contribution
 *   complete  → after lock expiry, escrow returns each member's bond (SPLIT)
 *
 * Sequencing note. FlowVault applies a principal's stored routing rules on its
 * *next* deposit, so for every routed deposit we broadcast `set-routing-rules`,
 * wait for it to confirm, then broadcast the `deposit`. Same-sender txs are thus
 * strictly ordered, which also keeps nonces clean. Confirmation can be disabled
 * (`confirm: false`) for fast local dry-runs, but real testnet runs need it.
 *
 * SERVER-ONLY — signs with managed keys via lib/members.ts.
 */
import { CIRCLE } from "./constants";
import { waitForTx } from "./explorer";
import { currentBlock, deposit, readState, setStrategy, withdraw, type Strategy } from "./flow";
import { getCircleActors, type Actor, type EscrowActor } from "./members";
import {
  appendEvent,
  loadCircle,
  saveCircle,
  type CircleState,
  type EventKind,
  type LedgerEvent,
  type RoundRecord,
} from "./ledger";

export interface RunOptions {
  /**
   * Wait for each broadcast tx to settle on-chain before firing the next
   * dependent one. Default `true` (required for real testnet correctness).
   */
  confirm?: boolean;
  /** Optional hook fired after every recorded event (progress logging). */
  onEvent?: (event: LedgerEvent) => void;
  /**
   * Phase 2 — simulate defaults. Maps a 0-based round index to the member ids
   * who miss their contribution that round. Those members move no funds during
   * the round; the escrow makes the shorted recipient whole from the
   * defaulter's forfeited bond at {@link complete}. Propagates through
   * runAllRounds/autopilot. Omit for the honest, no-default happy path.
   */
  defaults?: Record<number, number[]>;
}

/** Total commitment bonds pooled in the escrow (whole USDCx, as a string). */
function totalBonds(): string {
  return String(CIRCLE.memberCount * Number(CIRCLE.bond));
}

/** Pot a recipient receives each round (whole USDCx, as a string). */
function potPerRound(): string {
  return String((CIRCLE.memberCount - 1) * Number(CIRCLE.contribution));
}

/** Defaulters recorded on a round, tolerating legacy circles without the field. */
function defaultersOf(round: RoundRecord): number[] {
  return round.defaulters ?? [];
}

/**
 * Total USDCx a member owes the pool from all the rounds they defaulted on:
 * (rounds defaulted) × contribution. This is deducted from their bond at
 * completion (the forfeit that funds each shorted recipient's compensation).
 */
function shortfallCausedBy(state: CircleState, memberId: number): number {
  const rounds = state.rounds.filter((r) => defaultersOf(r).includes(memberId)).length;
  return rounds * Number(state.contribution);
}

/** Wait for a tx to reach a terminal state; throw if it did not succeed. */
async function confirm(txid: string): Promise<void> {
  const status = await waitForTx(txid);
  if (status !== "success") {
    throw new Error(`Transaction ${txid} did not confirm (status: ${status}).`);
  }
}

/**
 * The core money-move: set a routing strategy, (optionally) wait for it, then
 * deposit — so FlowVault applies LOCK/SPLIT/HOLD atomically on that deposit.
 * Returns the deposit txid (the moment funds actually move).
 */
async function routedDeposit(
  vault: Actor["vault"] | EscrowActor["vault"],
  strategy: Strategy,
  amount: string,
  opts: RunOptions
): Promise<string> {
  const strat = await setStrategy(vault, strategy);
  if (opts.confirm !== false) await confirm(strat.txid);

  const dep = await deposit(vault, amount);
  if (opts.confirm !== false) await confirm(dep.txid);

  return dep.txid;
}

/** Append an event, persist nothing, and fire the progress hook. */
function record(
  state: CircleState,
  opts: RunOptions,
  event: Omit<LedgerEvent, "at">
): void {
  appendEvent(state, event);
  const last = state.events[state.events.length - 1];
  opts.onEvent?.(last);
}

/**
 * Create a fresh, empty circle with the standard 6-member payout order and
 * pending rounds. Idempotent per id only in the sense that it overwrites.
 */
export async function createCircle(id: string): Promise<CircleState> {
  const payoutOrder = Array.from({ length: CIRCLE.memberCount }, (_, i) => i);
  const rounds: RoundRecord[] = payoutOrder.map((recipientId, index) => ({
    index,
    recipientId,
    status: "pending",
    contributionTxids: [],
    potUsdcx: potPerRound(),
    defaulters: [],
    shortfallUsdcx: "0",
    compensationTxids: [],
  }));

  const state: CircleState = {
    id,
    phase: "forming",
    memberCount: CIRCLE.memberCount,
    contribution: CIRCLE.contribution,
    bond: CIRCLE.bond,
    payoutOrder,
    currentRound: 0,
    createdBlock: null,
    endBlock: null,
    escrow: { address: null, bondLockTxid: null },
    rounds,
    events: [],
    updatedAt: new Date().toISOString(),
  };

  return saveCircle(state);
}

/** Load an existing circle or throw a clear error. */
async function requireCircle(id: string): Promise<CircleState> {
  const state = await loadCircle(id);
  if (!state) throw new Error(`Circle "${id}" not found. Create it first.`);
  return state;
}

/**
 * Phase 1 — Join. Every member SPLITs their bond into the escrow; then the
 * escrow LOCKs the pooled bonds until `endBlock`. Moves the circle
 * `forming → bonded`.
 */
export async function join(id: string, opts: RunOptions = {}): Promise<CircleState> {
  const state = await requireCircle(id);
  if (state.phase !== "forming") {
    throw new Error(`join() requires phase "forming", got "${state.phase}".`);
  }

  const { escrow, members } = getCircleActors();
  state.escrow.address = escrow.address;

  // Establish the lock window relative to the current tip (short, per §6).
  const tip = await currentBlock(escrow.vault, escrow.address);
  const endBlock = tip + CIRCLE.lockWindowBlocks;
  state.createdBlock = tip;
  state.endBlock = endBlock;

  // 1) Each member SPLITs their bond to the escrow principal.
  for (const member of members) {
    const txid = await routedDeposit(
      member.vault,
      { splitAddress: escrow.address, split: state.bond, lock: "0" },
      state.bond,
      opts
    );
    record(state, opts, {
      kind: "bond",
      label: `${member.name} bonds ${state.bond} USDCx into escrow`,
      actor: member.address,
      recipient: escrow.address,
      amount: state.bond,
      txid,
    });
    await saveCircle(state);
  }

  // 2) Escrow LOCKs the pooled bonds until the circle ends. The trust anchor.
  const lockTxid = await routedDeposit(
    escrow.vault,
    { lock: totalBonds(), lockUntilBlock: endBlock, splitAddress: null, split: "0" },
    totalBonds(),
    opts
  );
  state.escrow.bondLockTxid = lockTxid;
  record(state, opts, {
    kind: "escrow-lock",
    label: `Escrow locks ${totalBonds()} USDCx of bonds until block ${endBlock}`,
    actor: escrow.address,
    amount: totalBonds(),
    txid: lockTxid,
  });

  state.phase = "bonded";
  return saveCircle(state);
}

/**
 * Phase 1 — Run one round. Every non-recipient member SPLITs their contribution
 * to the round's recipient. Recipient receives (N-1) × contribution. Advances
 * `currentRound` and moves the circle `bonded → active`.
 */
export async function runRound(id: string, opts: RunOptions = {}): Promise<CircleState> {
  const state = await requireCircle(id);
  if (state.phase !== "bonded" && state.phase !== "active") {
    throw new Error(`runRound() requires phase "bonded" or "active", got "${state.phase}".`);
  }
  if (state.currentRound >= state.rounds.length) {
    throw new Error("All rounds are already complete.");
  }

  const { members } = getCircleActors();
  const r = state.currentRound;
  const round = state.rounds[r];
  const recipient = members[round.recipientId];

  round.status = "running";
  state.phase = "active";
  // Members flagged to miss this round (Phase 2 default simulation).
  const defaulting = new Set(opts.defaults?.[r] ?? []);
  round.defaulters = [];
  await saveCircle(state);

  // Every other member funds the pot toward the recipient (sequenced SPLITs).
  // A defaulter moves nothing now — the escrow covers their share at completion.
  for (const member of members) {
    if (member.id === recipient.id) continue;

    if (defaulting.has(member.id)) {
      // A member's forfeited bond funds their own compensation, so their total
      // missed contributions can never exceed their bond — otherwise the escrow
      // would have to dip into other members' bonds and break conservation.
      const alreadyForfeited = shortfallCausedBy(state, member.id);
      if (alreadyForfeited + Number(state.contribution) > Number(state.bond)) {
        throw new Error(
          `${member.name} cannot default on round ${r + 1}: their ${state.bond} USDCx ` +
            `bond already covers the maximum ${Number(state.bond) / Number(state.contribution)} ` +
            `missed round(s). Raise the bond to allow more.`
        );
      }
      round.defaulters.push(member.id);
      record(state, opts, {
        kind: "default",
        label: `${member.name} misses round ${r + 1} — escrow will cover ${state.contribution} USDCx from their bond`,
        round: r,
        actor: member.address,
        recipient: recipient.address,
        amount: state.contribution,
      });
      await saveCircle(state);
      continue;
    }

    const txid = await routedDeposit(
      member.vault,
      { splitAddress: recipient.address, split: state.contribution, lock: "0" },
      state.contribution,
      opts
    );
    round.contributionTxids.push(txid);
    record(state, opts, {
      kind: "contribution",
      label: `${member.name} → ${recipient.name}: ${state.contribution} USDCx (round ${r + 1})`,
      round: r,
      actor: member.address,
      recipient: recipient.address,
      amount: state.contribution,
      txid,
    });
    await saveCircle(state);
  }

  round.shortfallUsdcx = String(round.defaulters.length * Number(state.contribution));
  round.status = "complete";
  const shortfallNote =
    round.defaulters.length > 0
      ? ` (${round.contributionTxids.length} contributed now, ${round.shortfallUsdcx} USDCx covered by escrow at completion)`
      : "";
  record(state, opts, {
    kind: "payout",
    label: `${recipient.name} receives the round ${r + 1} pot: ${round.potUsdcx} USDCx${shortfallNote}`,
    round: r,
    recipient: recipient.address,
    amount: round.potUsdcx,
  });

  state.currentRound = r + 1;
  return saveCircle(state);
}

/** Run every remaining round back-to-back. */
export async function runAllRounds(id: string, opts: RunOptions = {}): Promise<CircleState> {
  let state = await requireCircle(id);
  while (state.currentRound < state.rounds.length) {
    state = await runRound(id, opts);
  }
  return state;
}

/**
 * Phase 1 — Complete. After the escrow's bond-lock has expired, the escrow
 * reclaims the pooled bonds and SPLITs each member's bond back to them. Moves
 * the circle `active → complete`.
 */
export async function complete(id: string, opts: RunOptions = {}): Promise<CircleState> {
  const state = await requireCircle(id);
  if (state.currentRound < state.rounds.length) {
    throw new Error("Cannot complete: not all rounds have run yet.");
  }
  if (state.phase === "complete") return state;

  const { escrow, members } = getCircleActors();

  // The lock must have expired for the escrow to reclaim the bonds.
  const tip = await currentBlock(escrow.vault, escrow.address);
  if (state.endBlock !== null && tip < state.endBlock) {
    const remaining = state.endBlock - tip;
    throw new Error(
      `Escrow bond-lock still active: ${remaining} block(s) until ${state.endBlock} ` +
        `(current ${tip}). Wait for expiry, then complete.`
    );
  }

  // Reclaim the now-unlocked bonds from the escrow vault to its wallet…
  const reclaim = await withdraw(escrow.vault, totalBonds());
  if (opts.confirm !== false) await confirm(reclaim.txid);
  record(state, opts, {
    kind: "note",
    label: `Escrow reclaims ${totalBonds()} USDCx (lock expired)`,
    actor: escrow.address,
    amount: totalBonds(),
    txid: reclaim.txid,
  });
  await saveCircle(state);

  // 1) Compensation — make every shorted recipient whole from the forfeited
  // bonds. This is the money-move a pure-v2 vault can't do (implementation.md
  // §3 step 5); it settles here rather than mid-round because the bonds are
  // LOCKed until the circle ends, so the escrow only has movable funds now.
  for (const round of state.rounds) {
    const shortfall = defaultersOf(round).length * Number(state.contribution);
    if (shortfall <= 0) continue;
    const recipient = members[round.recipientId];
    const amount = String(shortfall);
    const txid = await routedDeposit(
      escrow.vault,
      { splitAddress: recipient.address, split: amount, lock: "0" },
      amount,
      opts
    );
    round.compensationTxids.push(txid);
    record(state, opts, {
      kind: "compensation",
      label: `Escrow makes ${recipient.name} whole for round ${round.index + 1}: ${amount} USDCx from forfeited bonds`,
      round: round.index,
      actor: escrow.address,
      recipient: recipient.address,
      amount,
      txid,
    });
    await saveCircle(state);
  }

  // 2) Bond return — return each member's bond MINUS whatever they forfeited to
  // cover their own defaults. A member who never defaulted gets their full bond
  // back; a defaulter's forfeit already funded the compensation above.
  for (const member of members) {
    const returnable = Number(state.bond) - shortfallCausedBy(state, member.id);

    if (returnable <= 0) {
      record(state, opts, {
        kind: "note",
        label: `${member.name} forfeits their ${state.bond} USDCx bond — it covered their missed contribution(s)`,
        actor: escrow.address,
        recipient: member.address,
        amount: state.bond,
      });
      await saveCircle(state);
      continue;
    }

    const amount = String(returnable);
    const full = returnable === Number(state.bond);
    const txid = await routedDeposit(
      escrow.vault,
      { splitAddress: member.address, split: amount, lock: "0" },
      amount,
      opts
    );
    record(state, opts, {
      kind: "bond-return",
      label: full
        ? `Escrow returns ${member.name}'s ${amount} USDCx bond`
        : `Escrow returns ${member.name}'s remaining ${amount} USDCx bond (rest forfeited to their default)`,
      actor: escrow.address,
      recipient: member.address,
      amount,
      txid,
    });
    await saveCircle(state);
  }

  // Capture the escrow's final vault state so the read API can render this
  // completed circle's OWN escrow numbers (drained to 0) rather than a live
  // read of the shared escrow principal, which would leak a later circle's
  // balance. Best-effort: a read failure just leaves the API to fall back.
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
 * Drive an entire circle end-to-end on the managed accounts: create (if new),
 * join, run all rounds, and — if the lock has expired — complete. This is the
 * "autopilot" the orchestrator route exposes.
 */
export async function autopilot(id: string, opts: RunOptions = {}): Promise<CircleState> {
  let state = (await loadCircle(id)) ?? (await createCircle(id));

  if (state.phase === "forming") state = await join(id, opts);
  if (state.phase === "bonded" || state.phase === "active") state = await runAllRounds(id, opts);

  // Completion depends on lock expiry; skip gracefully if still locked.
  if (state.currentRound >= state.rounds.length && state.phase !== "complete") {
    const { escrow } = getCircleActors();
    const tip = await currentBlock(escrow.vault, escrow.address);
    if (state.endBlock === null || tip >= state.endBlock) {
      state = await complete(id, opts);
    }
  }

  return state;
}

/** Re-export kinds for consumers that render the ledger. */
export type { EventKind };
