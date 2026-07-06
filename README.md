# Sanctuary

**Programmable, Bitcoin-secured savings circles on Stacks.**
The oldest way to save — the rotating savings circle (ROSCA / **susu** / **tanda** / "committee")
that ~1B+ people already run on trust — reimagined as self-driving money, composed entirely from
FlowVault's **Lock · Split · Hold** primitives and settled with Bitcoin finality.

> FlowVault Builder Bounty submission · Stacks **testnet** · every transaction below is real and
> auditable on the Hiro explorer.

---

## What it is

A savings circle: `N` members each contribute a fixed amount every round, and each round the **whole
pot** rotates to one member — a lump sum exactly when they need it (school fees, a fridge for the
shop, a rent deposit). Members post a **commitment bond** up front so no one can walk away mid-circle.

Sanctuary runs this on-chain, automatically:

- **Self-driving.** An orchestration engine drives a live 3-member circle end-to-end on managed
  testnet accounts — judges watch real LOCK + SPLIT transactions fire with explorer links.
- **Join it yourself.** A connect-wallet path lets you join a round with your own wallet (Leather /
  Xverse) — the same on-chain move the engine makes, no private key ever leaving your wallet.
- **Auditable.** Bonds are locked in an escrow vault you can read live; every contribution, lock, and
  payout is a verifiable Stacks transaction anchored to Bitcoin.

## Why it fits the bounty

The bounty rewards **new financial behaviors** built on programmable routing and disqualifies
dashboards / wallet-wrappers / clones. A rotating circle is a genuinely novel on-chain behavior that
**needs all three primitives** and a real orchestration engine — it maps onto every judging axis:

| Axis | How Sanctuary earns it |
|------|------------------------|
| Innovation & Design (35%) | Culturally original — a billion-person tradition made programmable; a living, human hero UI |
| FlowVault Integration (30%) | Uses **all three** primitives (Lock + Split + Hold), both signer modes |
| Technical Execution (20%) | A real state-machine engine sequencing splits over blocks; unit-tested invariants |
| Ecosystem Value (15%) | A forkable `circle-engine`; documented SDK feedback + a Clarity escrow proposal |

## The three primitives → the circle

| Circle mechanic | Primitive |
|-----------------|-----------|
| Post commitment bond → escrow | **SPLIT** |
| Escrow secures pooled bonds until circle end | **LOCK** |
| Each round, the pot rotates to one member | **SPLIT** (sequenced, many-to-one) |
| Pre-funded liquidity buffers | **HOLD** |
| Default → shorted member made whole from defaulter's bond | **SPLIT** (escrow) |
| Completion → bonds returned | **SPLIT** (escrow) |

Full detail in **[INTEGRATION.md](./INTEGRATION.md)**.

## Proof (testnet)

A complete 3-member lifecycle = **14 real transactions**. Escrow principal
`ST3BBEF5Q148CCEZ14Y0EJDTRAHWMKDEQTJVZ15CT`.

- Escrow bond **LOCK** — [`b68df8…a2cf`](https://explorer.hiro.so/txid/0xb68df8994b0c6c777e2b5a835aed06afc45b90e0e5f55f151f3c47ec38f3a2cf?chain=testnet)
- Round payout **SPLIT** — [`978af8…9cfde`](https://explorer.hiro.so/txid/0x978af837a468a3846d37b3a59420d178e3da4257d37575d44775da787679cfde?chain=testnet)
- Final **bond return** — [`31f02c…1d38`](https://explorer.hiro.so/txid/0x31f02cc6b002c6cd61a0f768b246ab52b58d64b1e9ee1793e44acdcec95d1d38?chain=testnet)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill with TESTNET keys only (see below)
npm run dev                  # http://localhost:3000
```

- `/create` — **start your own real circle.** Set the size, contribution, and bond; then real
  members join with their own wallets and fund upfront. See "Open circles" in **[DEMO.md](./DEMO.md)**.
- `/` — the story landing. "Watch the circle live" links into the completed circle below.
- `/circle/demo` — a **completed** circle: a full 3-member lifecycle (14 real testnet txs)
  you can click through to the Hiro explorer. Nothing to run — it already happened.
- `/circle/live` — a **mid-flight** circle: round 1 settled, rounds 2–3 pending, escrow read
  live. The "Run the circle live" button here advances the remaining rounds on testnet
  (needs managed keys; takes a few minutes as it waits on block confirmations).

> New here? **[DEMO.md](./DEMO.md)** explains exactly what each "live" surface does and gives
> a click-by-click demo runbook — start there.

### Environment (testnet only)

Signing keys are **server-only** and read from `.env.local` (gitignored). See
[`.env.example`](./.env.example):

```
ESCROW_KEY=        # the app-run escrow principal
MEMBER_1_KEY=      # managed demo members (join / payout order)
MEMBER_2_KEY=
MEMBER_3_KEY=
```

Without keys the app still builds and renders (read-only paths); the orchestrator returns a clear
"keys not configured" error. **Testnet keys only — never mainnet.** See **[SECURITY.md](./SECURITY.md)**.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` / `build` / `start` | Next.js app |
| `npm test` | Vitest — pot math, lifecycle, default compensation, escrow balance (13 tests) |
| `npm run typecheck` / `lint` | `tsc --noEmit` / `next lint` |
| `npm run verify:phase1` | Read-only pre-flight: per-account STX/USDCx GO/NO-GO |
| `npm run phase1:run` | Drive the autopilot, then assert ledger invariants + live escrow read |
| `npm run phase2:default` | Run a circle with a simulated default; assert on-chain compensation |

## Architecture

```
app/
  page.tsx                 # story landing
  circle/[id]/page.tsx     # live circle hero
  api/orchestrator/route.ts# drive the managed circle (server-only signing)
  api/circle/route.ts      # read live circle + escrow state
lib/
  circle-engine.ts         # the rotating-circle state machine (reusable)
  flow.ts / wallet.ts      # flowvault-sdk wrappers: senderKey + wallet modes
  members.ts ledger.ts     # members/escrow; JSON persistence of rounds + txids
  constants.ts explorer.ts # contract targets, economics; txid → explorer URL
components/                # CircleRing, RoundTimeline, OutcomeReveal, ConnectJoin, …
```

**Tech:** Next.js 14 (App Router, TS) · TailwindCSS · Framer Motion · `flowvault-sdk` ·
`@stacks/connect` · `@stacks/transactions`. Design system: **Warm Vault** (`design-system/MASTER.md`).

## The honest constraint

FlowVault v2 is per-principal with self-locks only and no native multi-recipient split, so the
circle's many-to-one payouts and third-party bond custody use an **off-chain orchestrator** + an
**app-run escrow principal**, presented as a **trust-minimized coordinator, not trustless**, on
**testnet only**. The [SDK feedback](./FLOWVAULT_FEEDBACK.md) documents each gap we hit and proposes
a native Clarity `circle-escrow` extension that would make circles fully trustless.

## Docs

- **[DEMO.md](./DEMO.md)** — what's real vs. orchestrated, the three "live" surfaces, and a demo runbook.
- **[script.md](./script.md)** — the ≤3-minute spoken demo-video script.
- **[INTEGRATION.md](./INTEGRATION.md)** — how the SDK is used, primitive-by-primitive, with code.
- **[FLOWVAULT_FEEDBACK.md](./FLOWVAULT_FEEDBACK.md)** — SDK gaps, workarounds, and a Clarity proposal.
- **[SECURITY.md](./SECURITY.md)** — trust model, key custody, invariants.
- **[implementation.md](./implementation.md)** — the full build plan and phase log.
