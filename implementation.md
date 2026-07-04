# Sanctuary — Implementation Plan

> **Programmable, Bitcoin-secured Savings Circles on Stacks**
> FlowVault Builder Bounty submission. Solo builder · ~8 days (start **July 1** → submit **July 9, 23:59 UTC**).

---

## 1. Context — Why we're building this

The FlowVault bounty rewards **new financial behaviors** built on programmable USDCx routing (Lock / Split / Hold) on Stacks. It **disqualifies** generic dashboards, wallet wrappers, simple deposit UIs, and clones of the two reference demos (**FlowPay** = one-shot split; **Savings-Vault** = fixed 80/20 lock).

**Judging:** Innovation & Design **35%** · FlowVault Integration **30%** · Technical Execution **20%** · Ecosystem Value **15%**.

**The idea — Sanctuary.** We reframe the oldest financial instrument on earth — the rotating savings circle (**ROSCA / Susu / Tanda / "committee"**) that ~1B+ unbanked people already run on trust — as **programmable, self-driving money secured by Bitcoin finality.** Members pool a fixed contribution each round; each round the pot rotates to one member. Never done on Stacks/Bitcoin with atomic routing. It hits every rubric axis: culturally original (Innovation), uses all three primitives (Integration), needs a real orchestration engine (Technical), and onboards diaspora/unbanked communities with a forkable template (Ecosystem).

**The honest constraint we design around.** FlowVault v2 is *per-principal*: one vault per wallet, routing rules set first then executed atomically on the **next `deposit()`** (LOCK an amount until a block, SPLIT an amount to one principal, HOLD the rest). There is **no multi-recipient split, no laddered locks, and no third-party clawback** — locks are self-locks. The circle's many-to-one round payouts and its commitment bonds therefore require an **off-chain orchestration layer that sequences deposits over blocks**, plus an **app-run `circle-escrow` principal** that genuinely custodies bonds. We present the escrow as a trust-**minimized** coordinator (not "trustless") and ship a written Clarity-escrow proposal as the roadmap (Builder-Award-eligible feedback).

**Confirmed architecture — Autopilot + escrow-principal.** A backend orchestrator runs a 6-member demo circle automatically on managed testnet accounts (SDK `senderKey` mode) — judges watch real LOCK + SPLIT txs fire live with explorer links — plus a **connect-wallet path** so a judge can join a real round with their own wallet.

**Confirmed scope — Solo, polished MVP.** One killer ~3-min demo, ≥1 real testnet circle, strong README + video. **Cut:** multi-circle management, auth, mobile.

> **Scoping note (funding-driven): the live demo circle runs 3 members, not 6.** Only three managed wallets (Amara/Chidi/Fatima = `MEMBER_1/2/3_KEY`) received testnet USDCx; the other three hold none and cannot be funded (USDCx is protocol-mint-gated, dispensed manually). A 3-member circle completes a full real on-chain lifecycle within existing funds and exercises all three primitives identically. `CIRCLE.memberCount`/`rounds` and `MEMBER_PROFILES` are set to 3; bump both back to 6 (uncomment the extra profiles) if the remaining wallets are ever funded.

---

## 2. SDK facts we rely on (verified — `flowvault-sdk@0.1.2`)

- `new FlowVault({ network, senderKey | (senderAddress + contractCallExecutor), contractAddress?, ... })`. Contract fields default to testnet v2.
- **Testnet defaults:** FlowVault `STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2`; USDCx `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx`.
- **Methods:** `setRoutingRules`/`createStrategy({ lockAmount, lockUntilBlock, splitAddress, splitAmount })`, `deposit(amount)`, `withdraw(amount)`, `clearRoutingRules()`, `getVaultState(addr) → { totalBalance, lockedBalance, unlockedBalance, lockUntilBlock, currentBlock, routingRules }`, `getRoutingRules(addr)`, `hasLockedFunds(addr)`, `getCurrentBlockHeight(addr)`.
- **Utils:** `tokenToMicro`, `microToToken`, `isValidAddress`, `isBlockInFuture`. Errors extend `FlowVaultError` (codes 1001–1011: 1003 funds locked, 1004 routing exceeds deposit, 1011 cannot split to self…).
- **Signer modes:** backend `senderKey` (automation) and browser `@stacks/connect` `request('stx_callContract', …)` passed as `contractCallExecutor`.

---

## 3. How the circle maps onto Lock / Split / Hold (all three, essential)

| # | Step | Primitive | Mechanic |
|---|------|-----------|----------|
| 1 | **Join → bond escrow** | SPLIT | Member sets `{ splitAddress: ESCROW, splitAmount: bond, lockAmount: 0 }` then `deposit(bond)`. Bond leaves member's vault into the app-run escrow. |
| 2 | **Escrow locks bonds** | LOCK | Escrow deposits received bonds with `{ lockAmount: totalBonds, lockUntilBlock: circleEndBlock }`. Auditable via `getVaultState(ESCROW).lockedBalance` + `lockUntilBlock`. The trust anchor. |
| 3 | **Round → rotating pot** | SPLIT (sequenced) | For round *R* paying `payoutOrder[R]`, loop every other member *m*: set `{ splitAddress: recipient, splitAmount: contribution }` then `deposit(contribution)`. Recipient receives `(N-1)×contribution`. **The technical-depth centerpiece.** |
| 4 | **Liquid buffers** | HOLD | Members pre-fund contributions as unlocked balance; UI surfaces `unlockedBalance`. Optional: recipient's payout partially LOCKs as a "forced nest-egg." |
| 5 | **Default → compensation** | SPLIT (escrow) | Missed round → escrow makes the shorted recipient whole from the defaulter's escrowed bond. Closes the gap pure v2 can't. |
| 6 | **Complete → bond return** | SPLIT (escrow) | After final round + lock expiry, escrow returns each non-defaulting member's bond. |

Every step emits a txid rendered as an explorer link (`https://explorer.hiro.so/txid/<id>?chain=testnet`) → satisfies "auditable via explorer links."

---

## 4. Technical architecture

**Stack:** Next.js 14 (App Router, TS) · TailwindCSS · Framer Motion · `flowvault-sdk` · `@stacks/connect` · `@stacks/transactions` · `@stacks/network`. Backend = Next.js Route Handlers (Node runtime). Persistence = JSON ledger file (no DB for MVP). Managed keys = **server-only env vars, testnet only**.

```
sanctuary/
  app/
    page.tsx                  # landing + human story
    circle/[id]/page.tsx      # HERO: live circle view
    api/
      orchestrator/route.ts   # run autopilot / advance round (senderKey, server-only)
      circle/route.ts         # read live circle state
  lib/
    circle-engine.ts          # state machine: join, runRound (sequenced splits), handleDefault, complete
    flow.ts                   # flowvault-sdk wrappers for member + escrow vaults
    members.ts                # 6 demo members (names/addresses; keys from env)
    ledger.ts                 # JSON persistence of rounds + txids
    explorer.ts               # txid → explorer URL
  components/
    CircleRing.tsx            # animated 6-avatar ring + pot flow to recipient
    RoundTimeline.tsx         # rounds with live tx links
    MemberCard.tsx StreakBar.tsx BitcoinBadge.tsx ConnectJoin.tsx
  scripts/
    setup-members.ts          # generate + fund testnet accounts, acquire USDCx, seed a real circle
  content/story.ts            # human narratives (names + reasons: school fees, a fridge, a visa)
  README.md  INTEGRATION.md  DEMO.md  FLOWVAULT_FEEDBACK.md
```

**Reusable ecosystem contribution (15% + Builder Award):** extract orchestration as **`circle-engine`** — a documented TS layer over `flowvault-sdk` composing Lock/Split/Hold into a rotating-circle state machine others can fork. Ship `FLOWVAULT_FEEDBACK.md` documenting SDK gaps (no native multi-split, single lock bucket, no clawback) + a Clarity `circle-escrow` interface proposal.

**Emotional / design layer (35%):** hero screen = a living ring of 6 named human members; the pot visibly *flows* to the current recipient with motion; streak bars, block-countdown, Bitcoin-finality badge. Landing tells a real human story ("Amara in Lagos, her sister in London…") and shows the *outcome* when a pot lands. Every event carries an explorer link.

---

## 5. Build phases

> Each phase has a **Goal**, **Tasks**, and a **Done when** exit check. Phases are ordered to de-risk the hardest unknown (testnet USDCx) first.

### Phase 0 — De-risk & scaffold (Day 1) 🔴 highest priority ✅ DONE
**Goal:** prove one real testnet tx works end-to-end before building anything.
- [x] Scaffold Next.js 14 + TS + Tailwind; install `flowvault-sdk @stacks/connect @stacks/transactions @stacks/network framer-motion vitest` (+ `tsx`, `dotenv` for scripts).
- [x] Acquire **testnet STX** (Hiro faucet) for gas on all accounts — 7 managed accounts each funded with 500 STX (`scripts/setup-members.ts fund`, multi-pass to beat the IP rate limit).
- [x] Acquire **testnet USDCx** — funded via the FlowVault dApp faucet (protocol-mint is gated; no public contract faucet). Amara/Chidi/Fatima funded 10 USDCx each.
- [x] Write `lib/flow.ts` wrapper; script a single managed-member `deposit` with `split→escrow` and confirm the txid on the Hiro explorer (`scripts/setup-members.ts verify`).

**Done when:** one real testnet split tx is confirmed on-chain with an explorer link. ✅ **Confirmed** — Amara→Escrow split moved 1 USDCx (Amara 10→9, Escrow 0→1). set-routing-rules `0x46fb…63b2`, deposit/split `0xc660…3579`.

### Phase 1 — Orchestration engine (Day 2)
**Goal:** the circle runs on managed accounts.
- [x] `lib/members.ts` (6 demo members, keys from env), `lib/ledger.ts` (JSON persistence). *(also `lib/env.ts` for server-only key access.)*
- [x] `lib/circle-engine.ts`: `join` (bond→escrow), escrow **LOCK** until `circleEndBlock`, `runRound` (sequenced splits → recipient), `complete`, bond return. *(plus `autopilot` end-to-end driver; strategy→deposit are confirmed on-chain in order.)*
- [x] `app/api/orchestrator/route.ts` drives managed members; `app/api/circle/route.ts` reads live state (with explorer links).

**Done when:** a full circle (join → all rounds → complete) executes via the API with real testnet txids in the ledger. ✅ **VERIFIED LIVE (3-member circle).** Full lifecycle ran on testnet — 3 bond SPLITs → escrow LOCK → 3 rounds (6 contributions, 3 payouts, Amara → Chidi → Fatima) → lock expiry → escrow reclaim + 3 bond-returns = **14 real on-chain txs**, `phase = "complete"`, escrow vault drained to 0 (all bonds returned). Ledger at `data/circles/demo.json`. Escrow lock tx `0xb68df8…a2cf`; final bond-return `0x31f02c…1d38`.
>
> Tooling added for repeatable verification: `npm run verify:phase1` (read-only pre-flight — per-account STX/USDCx GO/NO-GO) and `npm run phase1:run` (drives the autopilot with confirmation, then asserts the ledger invariants + a live escrow read). Rate-limit resilience added to `lib/flow.ts` (429 exponential backoff) after the free-tier Hiro API throttled a mid-run burst.

### Phase 2 — Robustness & correctness (Day 3)
**Goal:** handle defaults and prove the math.
- [x] Default → escrow-compensation path. A member can miss a round (`runRound` honours `opts.defaults`); no funds move then. At `complete()`, after lock expiry, the escrow SPLITs each shorted recipient whole from the **defaulter's forfeited bond** (`kind: "compensation"`), and returns only the non-forfeited remainder of each bond. **Design note:** compensation settles at completion, not mid-round, because the pooled bonds are LOCKed until `endBlock` — the escrow has no movable funds until then. A guard rejects a member defaulting beyond what their bond covers (with `bond == contribution`, at most one miss), so the escrow never dips into other members' bonds and its books drain to exactly 0.
- [x] Explorer-link helper wired through every recorded event — centralized `eventUrl`/`withEventUrls` in `lib/explorer.ts`; used by `api/circle` and the scripts' progress logs.
- [x] **Vitest** unit tests: pot totals `(N-1)×contribution` + conservation (`circle-math`), full lifecycle (`circle-engine`), and **shortfall compensation + bond escrow/return balances** (`circle-default`: default recorded off-chain, recipient made whole, defaulter's bond forfeited, `Σ compensation + Σ bond-returns === pooled bonds`, over-default rejected). **13/13 green** (`npm test`), typecheck + lint clean.

**Done when:** unit tests pass ✅ and a simulated default is compensated correctly on-chain. ✅ **VERIFIED LIVE** — `npm run phase2:default` ran a real testnet circle (`default-demo`, never touched `demo`) with Chidi defaulting round 1. All 9 assertions green: one default recorded, defaulted round short one contribution, escrow made Amara whole (compensation SPLIT 1 USDCx, tx `0x81ad0f…d985`), Chidi forfeited their bond (no return), Amara & Fatima bonds returned, **escrow books balanced to zero** (Σ compensation + Σ bond-returns === 3 pooled bonds), `phase = complete`. Live escrow read confirmed drained: total=0 locked=0 unlocked=0. Escrow reclaim tx `0xcd2b98…6b84`.

### Phase 3 — Hero UI (Day 4) ✅ DONE
**Goal:** the circle is visible and alive.
- [x] `CircleRing` (avatar ring + SVG pot-flow to the current recipient, reduced-motion aware), `RoundTimeline` (vertical ledger with live explorer links per event), `MemberCard` / `StreakBar` (colorblind-safe: shape + aria, not color-only) / `BitcoinBadge`. Plus `Avatar`, `ExplorerLink`, `AutopilotButton`, and `event-meta`.
- [x] `app/circle/[id]/page.tsx` wired to `api/circle` (skeleton while loading, 15s poll while active, live escrow-vault proof panel); autopilot trigger button POSTs `api/orchestrator`. Root `app/page.tsx` now routes into the demo circle (full landing is Phase 5).

**Design system:** established **Warm Vault** direction (dark warm base + gold Bitcoin/value anchor + clay member accent + green confirmed-on-chain) via the ui-ux-pro-max skill; persisted to `design-system/MASTER.md`. Foundation: Warm Vault tokens in `globals.css`, semantic Tailwind tokens, Space Grotesk / Inter / JetBrains Mono (tabular figures for on-chain data), `lucide-react` icons (no emoji-as-icons).

**Done when:** watching the hero screen, a judge sees rounds advance with the pot flowing and clickable explorer links. ✅ Renders live from the `demo` ledger; running the autopilot button advances rounds with the pot animating to each recipient and every event linking to Hiro. Verified: `tsc` clean, `next lint` clean, `next build` passes (both routes compile), dev smoke-test GET /circle/demo + / → 200.

### Phase 4 — Wallet-mode join (Day 5) ✅ DONE
**Goal:** a judge can do a real tx themselves.
- [x] `lib/wallet.ts` — client-only bridge from the SDK's `contractCallExecutor` mode onto `@stacks/connect` v8 (`request('stx_callContract', …)`): connect/disconnect + session restore, `walletVault()` (a FlowVault bound to the connected wallet), `setJoinStrategy` (SPLIT → escrow) / `depositJoin`, and a spendable-USDCx balance read off the Hiro API. Amount + post-condition conventions mirror `lib/flow.ts` exactly (whole USDCx → `tokenToMicro`), so the judge signs the *same* split-then-deposit move the managed engine makes.
- [x] `components/ConnectJoin.tsx` — the join UI: connect wallet → shows address + USDCx balance (guards insufficient-balance with the protocol-mint-gated faucet note) → **two signatures** with a confirmation wait between them (FlowVault applies a principal's rule on its *next* deposit): sign routing rule → `waitForTx` → sign deposit → `waitForTx`. Both txs render as live Hiro explorer links; reduced-motion/aria/44px-touch-target compliant like the Phase 3 components.
- [x] Wired into `app/circle/[id]/page.tsx` sidebar, fed `circle.escrow.address` + `circle.bond` from the read API.

**Done when:** connecting a real wallet and joining a round produces a confirmed testnet tx. ✅ **Code complete & verified building** — `tsc` clean, `next lint` clean, `next build` passes (`/circle/[id]` compiles with the wallet bundle), dev smoke-test GET /circle/demo + / → 200. The final on-chain confirmation is a **manual browser step** (needs a Leather/Xverse wallet holding ≥1 USDCx on testnet — USDCx is protocol-mint-gated) and cannot be exercised headlessly; the flow reuses the identical `createStrategy`+`deposit` path already confirmed live on-chain in Phases 0–2.

### Phase 5 — Emotion & polish (Day 6) ✅ DONE
**Goal:** make judges *feel* it.
- [x] `content/story.ts` human narratives — hero copy, per-member outcome lines (`OUTCOMES`), the three-step `HOW_IT_WORKS` explainer (each mapped to a FlowVault primitive), the demo `PEOPLE`, and the ecosystem `CLOSING` framing. Client-safe (no key material).
- [x] Full **landing page** (`app/page.tsx`) — story-driven, following the Warm Vault "Community/Forum Landing" pattern: hero → how-a-circle-works → the three real people (avatar + reason + outcome) → Bitcoin-finality proof panel → "why it matters" closing → CTA into the live hero. One primary CTA per screen (gold gradient + glow), aria-labelled sections, 44px targets.
- [x] **Framer Motion polish** — `components/Reveal.tsx`, a scroll-in wrapper (transform/opacity only, ≤400ms ease-out, 30–50ms stagger) that renders statically under `prefers-reduced-motion`.
- [x] **Outcome reveal when a pot lands** — `components/OutcomeReveal.tsx` shows *what the pot meant* for the recipient (spring-in, keyed per recipient, reduced-motion aware), wired into `app/circle/[id]/page.tsx` below the ring: derives the last-landed recipient from `currentRound`/`phase` and pulls their line from `OUTCOMES`.
- [x] **Bitcoin-finality framing** — dedicated proof panel on the landing (ShieldCheck + `STORY.proof`) reinforcing the existing `BitcoinBadge`.

**Done when:** the landing + hero tell a coherent, moving story end-to-end. ✅ Landing renders the full narrative and routes into the live hero; the hero now reveals each recipient's human outcome as their pot lands. Verified: `tsc` clean, `next lint` clean, `next build` passes (`/` 9.16 kB static, `/circle/[id]` compiles), dev smoke-test GET / + /circle/demo → 200.

### Phase 6 — Proof & submission assets (Day 7)
**Goal:** everything the bounty requires.
- [x] Seed a real **completed** circle on testnet (historical txs) + a pre-seeded live round. **Both live on testnet, separate ledgers.** The **completed** circle is `demo` (`phase = complete`, 17 real txs, escrow drained to 0 — Phase 1). The **live** circle is `live` (`npm run seed:live`), seeded **mid-flight**: 3 bond SPLITs → escrow LOCK → round 1 pays Amara (2 USDCx pot) → **halt** with rounds 2–3 `pending`, so its `/circle/live` page shows settled history *and* a genuine in-progress round. Escrow verified custodying all 3 bonds live on-chain. Bond-lock tx `0x2eed82df…6158a32` (until block 4030008); round-1 contributions `0xe4f778…f4b2` (Chidi→Amara), `0xebefde…14f3` (Fatima→Amara).
  - **Escrow-snapshot fix (shared-principal correctness).** The escrow is one shared managed principal, so the live proof-panel read would leak whichever circle is running onto every other page. Fixed: `complete()` now captures the circle's final escrow vault state into the ledger (`escrow.snapshot`), and `api/circle` serves that snapshot for **completed** circles (demo → drained 0/0/0) while **active** circles read live (live → escrow holds 3). Backfilled the two existing completed ledgers. Also fixed a latent **Next.js Data-Cache staleness** bug: the App-Router fetch cache was serving a pre-seed empty escrow read; added `fetchCache = "force-no-store"` to the read route so the on-chain proof panel (and a judge's wallet-join bond) is always live. Verified end-to-end: `demo` → live 0/0/0 held 0; `live` → live total 3 held 2, matching a direct chain read. `tsc`/`lint`/`test` (13/13)/`build` all green.
- [x] **Demo video script written** ([`script.md`](./script.md)) — a beat-by-beat ≤3-min script (hook → how-it-works → architecture → live 17-tx circle walkthrough → default handling → wallet-join → close) with on-screen cues, the real circle facts to keep accurate, and the "don'ts" (trust-**minimized** not trustless, no key material on camera). *Recording + published video URL to follow — the script is the reusable artifact; the walkthrough runs against the already-seeded `demo` circle.*
- [x] Write `README.md`, `INTEGRATION.md` (FlowVault integration explanation), `FLOWVAULT_FEEDBACK.md`; collect all testnet tx explorer links. **Also added `SECURITY.md`.** These four are the **Builder Award** artifacts (outstanding SDK use · documentation · security · feedback): `FLOWVAULT_FEEDBACK.md` (8 concrete SDK gaps with impact + proposals, plus a native Clarity `circle-escrow` interface proposal), `INTEGRATION.md` (all 3 primitives mapped to code, both signer modes, real tx links), `SECURITY.md` (trust model, key custody, tested invariants, no-double-spend-on-retry boundary), and a real `README.md` replacing the Next.js boilerplate. All cross-linked; real testnet txids pulled from `data/circles/demo.json`.

**Done when:** public repo, demo URL, video, integration explanation, and ≥1 auditable testnet tx are all ready.

### Phase 7 — Buffer & submit (Day 8)
- [ ] Bug-fix; rehearse full autopilot lifecycle (**<3 min**); submit before July 9, 23:59 UTC.

---

## 6. Demo timing note (locks vs. real block cadence)

Testnet blocks are minutes apart, so use **short lock windows** (`lockUntilBlock = currentBlock + small N`) for the escrow bond lock so the full lifecycle (join → rounds → complete → bond return) runs with real txs in one sitting. Round-payout splits fire back-to-back (no lock dependency) while the UI narrates. Pre-seed a partially-completed circle so judges see both history and a live round.

---

## 7. Verification

- **Unit (vitest):** `circle-engine` math — pot totals, default shortfall compensation, bond escrow/return balances.
- **Integration (testnet):** scripted `runRound` across 6 managed accounts; assert `getVaultState` deltas (recipient `unlockedBalance` up by pot; escrow `lockedBalance` = Σ bonds with correct `lockUntilBlock`) and that txids confirm via the Hiro API.
- **Manual e2e:** connect a real wallet, "Join Round," confirm the tx on the explorer.
- **Demo rehearsal:** full autopilot lifecycle end-to-end in under 3 minutes with live explorer links.

---

## 8. Bounty submission checklist

- [ ] Public GitHub repository
- [ ] Working demo (deployed URL)
- [ ] Short demo video (≤3 min)
- [ ] Explanation of FlowVault integration (`INTEGRATION.md`)
- [ ] ≥1 successful testnet transaction (explorer links)
- [ ] Uses the FlowVault SDK + integrates ≥1 primitive (we use all three: Lock + Split + Hold)

---

## 9. Key risks & mitigations

1. **Testnet USDCx access (highest)** → resolve Phase 0; faucet/mint/maintainer; fallback contact npm author `yashpunmiya`.
2. **Lock timing for a live demo** → short lock windows + accelerated narration + pre-seeded history.
3. **Escrow custody optics** → present as trust-minimized coordinator; ship Clarity-escrow roadmap in `FLOWVAULT_FEEDBACK.md`.
4. **`senderKey` custody of demo members** → server-only env, **testnet only, never mainnet**.
