# How the Sanctuary demo really works

This doc explains what is *actually happening* when you watch the Sanctuary demo — what is
real, what is orchestrated, where the money goes, and how to reproduce every claim yourself.
It is deliberately blunt about the honest parts of the design.

For the primitive-by-primitive SDK code, see **[INTEGRATION.md](./INTEGRATION.md)**. For the
spoken walkthrough, see **[script.md](./script.md)**. For the trust model and key custody, see
**[SECURITY.md](./SECURITY.md)**.

---

## TL;DR

- **Everything on-chain is real.** Nothing is mocked, stubbed, or faked. Every bond, lock,
  contribution, payout, and bond-return is a genuine transaction on the **Stacks testnet**,
  settled with Bitcoin finality, and linked to the Hiro explorer so you can verify it.
- **What's "orchestrated" is the *sequencing*, not the money.** FlowVault v2 is per-principal
  (one vault per wallet, self-locks only, single split target). A rotating circle needs
  many-to-one payouts and third-party bond custody, so an **off-chain engine** sequences real
  deposits over blocks and an **app-run escrow principal** genuinely custodies the bonds. We
  call the escrow a **trust-minimized coordinator, not trustless** — and ship a Clarity proposal
  ([FLOWVAULT_FEEDBACK.md](./FLOWVAULT_FEEDBACK.md)) that would remove the trust entirely.
- **Two circles are seeded** on testnet: a **completed** one (`demo`) showing a full lifecycle,
  and a **live, mid-flight** one (`live`) showing an in-progress round.

---

## The three things called "live" (read this first)

The word **"live"** shows up in three different places, and they do three different
things. This is the single most confusing part of the app, so here it is plainly:

| Where you see it | What it actually is | What clicking it does |
|------------------|---------------------|-----------------------|
| **"Watch the circle live"** — the gold button on the landing page (`/`) | A **navigation link**, nothing more | Takes you to `/circle/demo` — the **already-completed** circle. **No transactions fire.** You're looking at a finished circle whose 14 real txs already ran; you click the explorer links to verify them. This is the safe, always-works view. |
| **`/circle/live`** — a URL you type in the address bar | A second, **seeded mid-flight** circle | Round 1 has really settled on testnet; rounds 2–3 are still pending. The escrow panel shows a **live read** of the escrow *actually holding the 3 bonds right now*. **Nothing in the UI links here** — you reach it by typing `/circle/live`. This is the "it's genuinely in progress" view. |
| **"Run the circle live"** — the gold button *on a circle page* (`AutopilotButton`) | The one button that **actually signs and broadcasts** | POSTs to `/api/orchestrator`, which drives the circle on testnet with the managed keys. This is real money and real block confirmations — see the table below for exactly what happens depending on which circle you click it on. |

### What "Run the circle live" does, depending on where you click it

It calls `autopilot`, which advances a circle from wherever it is to done. So the
outcome depends entirely on the circle's current phase:

| You click it on… | What happens |
|------------------|--------------|
| **`/circle/demo`** (already `complete`) | **Nothing on-chain.** Autopilot sees the circle is finished, so it has nothing to do — the spinner runs briefly, then stops. No new transactions. |
| **`/circle/live`** (`active`, round 1 done) | It runs **rounds 2 and 3 for real** — genuine testnet SPLIT transactions — and then completes the circle if the lock has expired. Takes **a few minutes** (it waits on block confirmations), spends real testnet USDCx, and needs the members funded. |
| **A fresh / unseeded circle id** | Full lifecycle from scratch: create → join → all rounds → complete. A dozen-plus real txs, several minutes. Can fail if the managed wallets are low on testnet USDCx. |

**Two hard requirements for that button to do anything:** (1) the managed signing keys
(`ESCROW_KEY`, `MEMBER_1/2/3_KEY`) must be set in `.env.local`, or it returns a clear
"keys not configured" error and fires nothing; (2) the managed wallets must actually
hold enough testnet USDCx.

### What to actually show in your demo

You do **not** need to click "Run the circle live" on camera — and for a recorded demo,
you probably shouldn't, because it's slow and can fail on funding. The recommended path
(this is what [script.md](./script.md) narrates):

1. **Open the landing (`/`).** Tell the story: susu / tanda / committee, the three people.
2. **Click "Watch the circle live"** → lands on `/circle/demo`, the **completed** circle.
   This always works and can't fail — every one of the 14 transactions is already on-chain.
3. **Click through the explorer links** — the escrow bond-lock, a round payout, a bond
   return. This is the whole point: "not a mock-up, click any link and verify it yourself."
4. **Point at the "Escrow vault" panel** showing the escrow drained to **0** — "every bond
   came back; no funds left our hands."
5. *(Optional, for a "it's genuinely running" beat)* **Type `/circle/live`** in the address
   bar to show a circle mid-flight, with the escrow panel reading a **live** balance that
   still holds the 3 pooled bonds.
6. *(Optional, only if you've pre-funded and rehearsed)* Click **"Run the circle live"** on
   `/circle/live` to advance a real round on camera — budget several minutes for it.

> **Tip for a clean recording of `/circle/live`:** its lock is intentionally short, so by
> the time you demo it the lock may have expired — the escrow then still holds all 3 bonds
> but shows them as `unlocked` rather than `locked`. If you want the panel to read "locked"
> on camera, run `npm run seed:live` shortly before recording (see the reproduce section
> below).

---

## What you're looking at

| Route | What it is |
|-------|------------|
| `/` | The story landing — the human framing (susu / tanda / committee), how a circle works, the three real people, the Bitcoin-finality panel. No on-chain calls; pure narrative. |
| `/circle/demo` | The **completed** circle. A full 3-member lifecycle already ran on testnet: **14 real on-chain transactions**. Escrow has drained to 0 (every bond returned). This is the "see the whole thing, end to end" view. |
| `/circle/live` | The **live, mid-flight** circle. Round 1 has settled (real txs); rounds 2–3 are still pending. This is the "watch it happen / it's genuinely in progress" view. |

Both circles are **separate ledger files** (`data/circles/demo.json`, `data/circles/live.json`)
and never touch each other.

---

## The cast (managed testnet principals)

The demo runs on **managed testnet accounts** — real Stacks accounts whose signing keys live in
server-only env vars (`.env.local`, gitignored, **testnet only**). See [SECURITY.md](./SECURITY.md).

| Role | Name | Testnet address |
|------|------|-----------------|
| Member 1 | Amara (Lagos) | `STB3TXXN46EGCDN2E87GRVV0XQ7H4AA11CXJ11NX` |
| Member 2 | Chidi (London) | `ST2AMPY7BWAQ35ESCAYJ994JFD90GMPVJC08QCA5T` |
| Member 3 | Fatima (Nairobi) | `STV7MHKCKHSFW9Z3B26Q77WDQDH3J9BR407EZ56V` |
| Escrow | Sanctuary Escrow | `ST3BBEF5Q148CCEZ14Y0EJDTRAHWMKDEQTJVZ15CT` |

> **Why 3 members and not 6?** USDCx is protocol-mint-gated on testnet (dispensed manually via
> the FlowVault dApp faucet), and only these three wallets could be funded. A 3-member circle
> exercises all three primitives and a full lifecycle identically. The code is written for `N`
> members — bump `CIRCLE.memberCount` back to 6 (and uncomment the extra profiles) the moment
> the other wallets get USDCx. Economics are kept tiny (**contribution = 1 USDCx, bond = 1
> USDCx**) so a full circle is cheap to run for real.

---

## The two ways money moves

Both paths call the **same** `flowvault-sdk` and make the **same** on-chain move
(set a routing rule, then deposit so LOCK/SPLIT/HOLD apply atomically). They differ only in
*who signs*.

1. **Managed autopilot (`senderKey` mode).** The orchestration engine signs with the managed
   members' keys server-side and drives the circle automatically. This is what the "Run the
   circle live" button and the seed scripts use. Server-only.

2. **Wallet-join (`@stacks/connect` mode).** A judge connects their own Leather/Xverse wallet
   and signs the join themselves — the same split-then-deposit the engine makes, but **no
   private key ever leaves their wallet**. See `lib/wallet.ts` + `components/ConnectJoin.tsx`.

---

## The lifecycle, and what each step maps to on-chain

For round `R` paying member `payoutOrder[R]`, with `N` members:

| # | Step | Primitive | What actually happens on-chain |
|---|------|-----------|-------------------------------|
| 1 | **Join** | SPLIT | Each member sets `{ split → escrow, splitAmount: bond }` then `deposit(bond)`. The bond leaves their vault into the escrow principal. (`N` txs) |
| 2 | **Escrow locks bonds** | LOCK | Escrow deposits the pooled bonds with `{ lock: Σbonds, lockUntilBlock: endBlock }`. The trust anchor — auditable via `getVaultState(escrow)`. (1 tx) |
| 3 | **Each round** | SPLIT (sequenced) | Every non-recipient member sets `{ split → recipient, splitAmount: contribution }` then `deposit(contribution)`. Recipient receives `(N-1) × contribution`. (`N-1` txs/round) |
| 4 | **Liquidity** | HOLD | Members pre-fund contributions as unlocked balance; the UI surfaces `unlockedBalance`. |
| 5 | **Default (if any)** | SPLIT (escrow) | A missed round moves no funds then; at completion the escrow makes the shorted recipient whole from the **defaulter's forfeited bond**. |
| 6 | **Complete** | SPLIT (escrow) | After the lock expires, the escrow reclaims the bonds and returns each non-defaulting member's bond. Books drain to exactly 0. |

**Sequencing note.** FlowVault applies a principal's stored routing rule on its *next* deposit,
so for every routed deposit the engine broadcasts `set-routing-rules`, **waits for it to
confirm**, then broadcasts the `deposit`. That ordering is why a live run takes a few minutes —
it's real block confirmation, not a spinner.

### The `demo` circle, transaction by transaction

**14 real on-chain transactions** (3 bonds → 1 escrow lock → 6 contributions → 1 escrow reclaim
→ 3 bond returns). The ledger also has **3 "payout" markers** (17 events total) — a payout *is*
the sum of that round's contributions, so it carries no separate txid; it's a UI marker for
"the pot landed."

- Escrow bond **LOCK** — [`b68df8…a2cf`](https://explorer.hiro.so/txid/0xb68df8994b0c6c777e2b5a835aed06afc45b90e0e5f55f151f3c47ec38f3a2cf?chain=testnet)
- Final **bond return** — [`31f02c…1d38`](https://explorer.hiro.so/txid/0x31f02cc6b002c6cd61a0f768b246ab52b58d64b1e9ee1793e44acdcec95d1d38?chain=testnet)
- Every other event links to the explorer from `/circle/demo`.

Payout order: **Amara → Chidi → Fatima**.

---

## The escrow, and the one subtlety worth understanding

The escrow is a **single shared managed principal**. That has one consequence worth knowing when
you read the "Escrow vault" proof panel:

- A **completed** circle shows a **snapshot** of *its own* final escrow state (captured at
  completion — drained to 0/0/0). So `/circle/demo` always shows the escrow it left behind, even
  though the same principal may now be custodying a different circle's bonds.
- An **active** circle shows a **live** read of the escrow right now. So `/circle/live` shows the
  escrow genuinely holding the 3 pooled bonds.

This is why the two pages can show different escrow numbers at the same time and both be correct.
(Implementation: `complete()` writes `escrow.snapshot` into the ledger; `app/api/circle` serves
the snapshot for completed circles and a live read for active ones. The read route also sets
`fetchCache = "force-no-store"` so Next.js never serves a stale cached vault read.)

### A note on the `live` circle's lock

Demo locks are intentionally **short** (`CIRCLE.lockWindowBlocks = 30`, ~an hour on testnet) so a
full lifecycle fits in one sitting. Because the `live` circle is deliberately left mid-flight, its
lock **will expire** while rounds 2–3 are still pending. When that happens the escrow still holds
all 3 bonds (`total = 3`) — they're just shown as `unlocked` rather than `locked`, and the
historical **bond-lock transaction** link still proves they were locked. If you want the panel to
read "locked" during a recording, re-seed the live circle shortly beforehand (see below).

---

## Reproduce it yourself

```bash
npm install
cp .env.example .env.local     # TESTNET keys only (ESCROW_KEY, MEMBER_1/2/3_KEY)
npm run dev                    # http://localhost:3000  (/circle/demo, /circle/live)
```

| Command | What it proves |
|---------|----------------|
| `npm run verify:phase1` | Read-only pre-flight: per-account STX + USDCx GO/NO-GO. No transactions. |
| `npm run phase1:run` | Drives a full circle (`demo`) end-to-end on testnet, then asserts ledger invariants + a live escrow read. |
| `npm run phase2:default` | Runs a circle where a member defaults; asserts the escrow compensates the shorted recipient on-chain and the books still balance to 0. |
| `npm run seed:live` | Seeds the **mid-flight** `live` circle (bonds → lock → round 1 → halt). Refuses to double-spend; use `-- --fresh` to reset the local ledger. |
| `npm test` | 13 unit tests: pot math, full lifecycle, default compensation, escrow balance conservation. |

Without keys the app still builds and renders read-only paths; the orchestrator returns a clear
"keys not configured" error. **Never use mainnet keys.**

---

## What is real vs. what to be honest about

**Real:**
- Every transaction on both circles is a genuine testnet tx, verifiable on the Hiro explorer.
- The escrow genuinely custodies and locks the pooled bonds; you can read its vault live.
- The wallet-join path signs the identical move with a judge's own wallet.
- The math (pot totals, default compensation, bond conservation) is unit-tested.

**Honest limitations:**
- The escrow is an **app-run coordinator**, not a trustless contract. FlowVault v2 can't express
  many-to-one payouts, laddered locks, or third-party clawback, so we sequence real single-split
  deposits off-chain and custody bonds in a managed principal. This is presented as
  **trust-minimized**, and [FLOWVAULT_FEEDBACK.md](./FLOWVAULT_FEEDBACK.md) proposes a native
  Clarity `circle-escrow` that removes the trust.
- The demo is **3 members on testnet** (USDCx funding constraint), with tiny economics and short
  locks tuned for a live demo — not production parameters.
- Persistence is a JSON ledger file (no DB); the deployed URL serves pre-seeded circles.

---

## Where to look in the code

| Concern | File |
|---------|------|
| The circle state machine (join / round / complete / default) | `lib/circle-engine.ts` |
| SDK wrappers, both signer modes | `lib/flow.ts`, `lib/wallet.ts` |
| Members + escrow (keys from server-only env) | `lib/members.ts`, `lib/env.ts` |
| Ledger schema + JSON persistence | `lib/ledger.ts` |
| Read API (live state + escrow snapshot/live logic) | `app/api/circle/route.ts` |
| Orchestrator API (drives managed circle) | `app/api/orchestrator/route.ts` |
| Hero UI (ring, timeline, outcome reveal, wallet join) | `components/` |
| Seed the live mid-flight circle | `scripts/seed-live.ts` |
