# Sanctuary

**Programmable, Bitcoin-secured savings circles on Stacks.**

The oldest way to save — the rotating savings circle (ROSCA / **susu** / **tanda** / "committee")
that a billion people already run on trust — rebuilt as self-driving money, composed entirely from
FlowVault's **Lock · Split · Hold** primitives and settled with Bitcoin finality.

> FlowVault Builder Bounty submission · Stacks **testnet** · every transaction the app shows is real
> and auditable on the Hiro explorer.

---

## The problem

Rotating savings circles move **hundreds of billions of dollars a year**, entirely on trust. A group
agrees to pay a fixed amount into a shared pot each round, and each round the whole pot goes to one
member — so everyone gets a lump sum on their turn, exactly when they need it (school fees, rent, a
fridge for the shop, stock for market week).

They work because of social pressure, and they fail the same way:

- **Someone takes an early payout and stops contributing.** The people later in the order are left short.
- **The organiser holds the money.** Members have to trust one person not to lose it or run.
- **There's no ledger.** Disputes come down to whose memory you believe.

The tradition is proven; the trust is fragile.

## The solution — Sanctuary

Sanctuary runs the exact same ritual, but the money is programmable and the ledger is public:

- **A commitment bond, locked on-chain.** Every member posts a bond up front. It's held in an escrow
  vault and **locked until the circle ends**, so no one can walk away mid-circle without consequence.
- **The pot rotates automatically.** Each round the whole pot routes to that round's recipient as a
  real on-chain payout — no organiser deciding who gets paid.
- **Every move is auditable.** Each contribution, lock, and payout is a verifiable Stacks transaction,
  anchored to Bitcoin. The escrow balance can be read live; at the end it drains to exactly zero.

Two ways to experience it:

| Route | What it is |
|-------|-----------|
| **`/circle/demo`** | A **completed** 3-member circle. A full lifecycle already ran on testnet — **14 real transactions** you can click straight through to the Hiro explorer. Nothing to run; it already happened. The always-works proof. |
| **`/create`** | **Start your own real circle.** Set the size, contribution, and bond; share the invite link; each member joins with **their own wallet** (Leather / Xverse) and funds their share upfront. When the last seat fills, the circle auto-forms, locks the bonds, and the pot begins rotating.

## AI assistant

Sanctuary has includes a built-in AI assistant that can answer questions about how Sanctuary works,
rotating savings circles, Bitcoin and Stacks, and how to get started. It is designed to help users
understand the product quickly and feel supported while exploring or creating a circle.


## How FlowVault powers it

Sanctuary is composed **entirely** from FlowVault's routing primitives — it never invents its own
token logic. Each circle mechanic is one primitive:

| Circle mechanic | FlowVault primitive |
|-----------------|---------------------|
| Member posts a commitment bond into the escrow | **SPLIT** (member → escrow) |
| Escrow secures the pooled bonds until the circle ends | **LOCK** (until `endBlock`) |
| Each round, the whole pot routes to one member | **SPLIT** (sequenced, many-to-one) |
| Members pre-fund their contributions as a liquid buffer | **HOLD** |
| A default → the shorted member is made whole from the defaulter's bond | **SPLIT** (escrow) |
| Completion → every bond is returned in full | **SPLIT** (escrow) |

**The core move, everywhere:** set a routing rule, then deposit — so FlowVault applies the
LOCK / SPLIT / HOLD atomically on that deposit. Because a principal's rule is applied on its *next*
deposit, the engines broadcast `set-routing-rules`, **wait for it to confirm**, then broadcast the
`deposit`. That ordering is why a live run takes minutes — it's real block confirmation, not a spinner.

**Two signer modes, one SDK:**

- **`senderKey` mode (server-side).** The demo orchestrator and the escrow sign real testnet
  transactions with managed keys held only in server env. Wrapped in `lib/flow.ts`.
- **Wallet mode (`@stacks/connect`).** A real member joining via `/create` signs the identical
  split-then-deposit in **their own** Leather / Xverse wallet — no private key ever leaves it.
  Wrapped in `lib/wallet.ts`.

Primitive-by-primitive detail with code lives in **[INTEGRATION.md](./INTEGRATION.md)**.

---

## Architecture

```
Browser (Next.js App Router, client components)
  /                     landing — the human story + how a circle works
  /circle/[id]          circle hero (rotation ring, timeline, live escrow read)
                        └─ open + forming? → lobby view (LobbyJoin, own-wallet)
  /create               organiser sets circle shape → shareable invite link

API routes (Node runtime, server-only signing)
  GET  /api/circle          read a circle's live state + escrow (snapshot if complete)
  POST /api/orchestrator    drive the managed demo circle (senderKey mode)
  POST /api/open/create     create an open lobby (ledger-only, no keys)
  POST /api/open/join       verify a member's funding tx, add them, auto-form when full
  POST /api/open/advance    escrow-signed rotation of a formed open circle

lib/ (engines + SDK integration)
  circle-engine.ts   managed-demo state machine (join → rounds → complete → default)
  open-circle.ts     real-user engine: fund-upfront lobby → auto-rotate → bond return
  flow.ts            flowvault-sdk wrappers, senderKey mode (server signing)
  wallet.ts          flowvault-sdk via @stacks/connect (member self-signing)
  members.ts         managed demo actors (keys from server env, addresses derived)
  escrow-actor.ts    escrow-only signer for open circles (ESCROW_KEY)
  env.ts             server-only key access + "is it configured?" guards
  ledger.ts          circle schema + JSON persistence (one file per circle)
  constants.ts       contract targets + circle economics
  explorer.ts        Hiro reads, tx confirmation waits, txid → explorer URLs
  circle-view.ts     read-API view types shared with the client

content/story.ts     narrative copy (headlines, people, outcomes) — no UI coupling
data/circles/*.json  each circle's full life + real txids (the audit trail)
components/          CircleRing, RoundTimeline, OutcomeReveal, MemberCard,
                    LobbyJoin, AutopilotButton, Navbar, Bitcoin/Explorer badges…
```

### How a circle moves (open / real-user flow)

```
organiser  ── POST /api/open/create ──▶  lobby (forming)  ── invite link ──▶  members
members    ── sign split→deposit in own wallet ──▶ fund bond + contributions into escrow
           ── POST /api/open/join ──▶ verify tx on-chain, record seat
last seat  ── auto-form ──▶ escrow LOCKs pooled bonds until endBlock ──▶ active
run        ── POST /api/open/advance ──▶ escrow SPLITs the pot to each round's recipient
lock ends  ── escrow reclaims + returns every bond ──▶ complete (books drain to 0)
```

Because every member's contributions are **prepaid into the escrow at join**, the escrow signs every
rotation itself — the circle is genuinely self-driving, and no member can default mid-circle.

**Tech:** Next.js 14 (App Router, TypeScript) · Tailwind CSS · Framer Motion · `flowvault-sdk` ·
`@stacks/connect` · `@stacks/transactions` · **Neon** (serverless Postgres).

**Persistence.** Each circle's entire life is one `CircleState` document (roster, rounds, and every
on-chain txid — the audit trail). It is stored behind a small backend-agnostic facade (`lib/store.ts`)
with two interchangeable backends, selected at runtime by whether `DATABASE_URL` is set:

- **Neon serverless Postgres** — production. A single `circles (id TEXT PK, state JSONB)` table,
  accessed over HTTP via `@neondatabase/serverless` (no connection pool, so it's safe in Vercel's
  per-request serverless functions). This is what makes the app deployable — Vercel's filesystem is
  read-only, so user-created circles need a durable store.
- **JSON files** (`data/circles/*.json`) — local development and the `tsx` scripts, unchanged.

The two demo circles (`demo`, `default-demo`) are **bundled into the app** (`lib/seeds.ts`), so the
`/circle/demo` proof pages render in production with zero database rows and no seeding step.

---

## Proof (testnet)

A complete 3-member `demo` lifecycle = **14 real transactions** (3 bonds → 1 escrow lock →
6 contributions → 1 escrow reclaim → 3 bond returns). Escrow principal
`ST3BBEF5Q148CCEZ14Y0EJDTRAHWMKDEQTJVZ15CT`.

- Escrow bond **LOCK** — [`b68df8…a2cf`](https://explorer.hiro.so/txid/0xb68df8994b0c6c777e2b5a835aed06afc45b90e0e5f55f151f3c47ec38f3a2cf?chain=testnet)
- Round payout **SPLIT** — [`978af8…9cfde`](https://explorer.hiro.so/txid/0x978af837a468a3846d37b3a59420d178e3da4257d37575d44775da787679cfde?chain=testnet)
- Final **bond return** — [`31f02c…1d38`](https://explorer.hiro.so/txid/0x31f02cc6b002c6cd61a0f768b246ab52b58d64b1e9ee1793e44acdcec95d1d38?chain=testnet)

Every other event links to the explorer directly from `/circle/demo`.

---
## Getting started

```bash
npm install
cp .env.example .env.local   # fill with TESTNET keys only (see below)
npm run dev                  # http://localhost:3000
```

Then:

- Open **`/`** for the story, then the **Demo** nav link (`/circle/demo`) to click through a completed
  circle's real transactions.
- Open **`/create`** to start your own circle. Each member needs a Leather / Xverse wallet on **Stacks
  testnet** funded with **USDCx** (the token the circle moves). Each member funds
  `bond + (N−1) × contribution` upfront — e.g. a 3-member, 1-USDCx circle needs **3 USDCx** per member.

> USDCx on testnet is protocol-mint-gated — fund each wallet via the FlowVault dApp faucet before
> joining. STX (for gas) comes from the standard Hiro testnet faucet.

### Environment (testnet only)

Signing keys are **server-only** and read from `.env.local` (gitignored). See
[`.env.example`](./.env.example):

```
DATABASE_URL=      # Neon Postgres connection string — required in production (see below)
ESCROW_KEY=        # the app-run escrow principal — the ONLY key /create needs
MEMBER_1_KEY=      # managed demo members that drive /circle/demo (join / payout order)
MEMBER_2_KEY=      # the app reads exactly CIRCLE.memberCount of these (currently 3)
MEMBER_3_KEY=
```

- **`DATABASE_URL`** points at a **Neon** serverless Postgres database. Set it and circles persist to
  the DB; leave it unset locally and they persist to `data/circles/*.json` instead. On Vercel it is
  **required** (read-only filesystem) — connecting a Neon database in the Vercel dashboard injects it
  automatically. The bundled demo circles need no database.
- **Open circles (`/create`)** need only `ESCROW_KEY` — members sign with their own wallets.
- **The managed `demo` circle** additionally needs `MEMBER_1..3_KEY`.
- Without keys the app still builds and renders read-only paths; signing routes return a clear
  "keys not configured" error and fire nothing.

**Testnet keys only — never mainnet.** See **[SECURITY.md](./SECURITY.md)** for the trust model and
key custody.

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` / `build` / `start` | Next.js app |
| `npm test` | Vitest — pot math, full lifecycle, default compensation, escrow balance conservation |
| `npm run typecheck` / `lint` | `tsc --noEmit` / `next lint` |
| `npm run setup` | Generate managed testnet member/escrow keys into `.env.local` |
| `npm run verify:phase1` | Read-only pre-flight: per-account STX / USDCx GO/NO-GO. No transactions |
| `npm run phase1:run` | Drive the managed circle end-to-end on testnet, then assert ledger invariants |
| `npm run phase2:default` | Run a circle with a simulated default; assert on-chain compensation |

---

## The honest constraint

FlowVault v2 is **per-principal**: one vault per wallet, self-locks only, a single split target. A
rotating circle needs **many-to-one payouts** and **third-party bond custody**, which v2 can't express
natively. So Sanctuary sequences real single-split deposits with an **off-chain engine** and custodies
the pooled bonds in an **app-run escrow principal**.

We're deliberate about this: the escrow is a **trust-minimised coordinator, not a trustless contract**,
and Sanctuary is **testnet only**. Every gap we hit — and a proposed native Clarity `circle-escrow`
extension that would remove the trust entirely — is documented in
**[FLOWVAULT_FEEDBACK.md](./FLOWVAULT_FEEDBACK.md)**.

---

## Docs

- **[script.md](./script.md)** — the ≤ 3-minute spoken demo-video script.
- **[INTEGRATION.md](./INTEGRATION.md)** — how the SDK is used, primitive-by-primitive, with code.
- **[FLOWVAULT_FEEDBACK.md](./FLOWVAULT_FEEDBACK.md)** — SDK gaps, workarounds, and a Clarity proposal.
- **[SECURITY.md](./SECURITY.md)** — trust model, key custody, and the money invariants.
