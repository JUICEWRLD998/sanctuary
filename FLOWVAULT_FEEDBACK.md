# FlowVault SDK — Builder Feedback

> From building **Sanctuary**, a rotating savings circle (ROSCA / susu / tanda) composed
> entirely from FlowVault's Lock / Split / Hold primitives on Stacks testnet.
>
> This is written as *constructive* feedback from a real integration, not a complaint list.
> Every gap below we hit in practice, worked around, and shipped — the workarounds are in the
> repo. Each item has **what we observed**, **impact**, and a **concrete proposal**. The last
> section sketches a native `circle-escrow` Clarity extension that would make circles trustless.

**SDK:** `flowvault-sdk@0.1.2` · **Contract:** `flowvault-v2` (testnet
`STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD`) · **Token:** `usdcx` (6 decimals).

---

## Summary

| # | Gap | Severity | Workaround shipped | Where |
|---|-----|----------|--------------------|-------|
| 1 | No native multi-recipient split | High | Sequence N−1 single splits per round | `lib/circle-engine.ts` |
| 2 | Single lock bucket per principal | Medium | One shared `endBlock` for all bonds | `lib/circle-engine.ts` |
| 3 | Self-lock only — no third-party clawback | High (trust model) | App-run escrow *principal* holds keys | `lib/members.ts`, `lib/escrow-actor.ts`, `SECURITY.md` |
| 4 | Routing rules apply on the *next* deposit (stateful) | Medium | Broadcast rules → await confirm → deposit | `lib/flow.ts` |
| 5 | Inconsistent txid field across signer modes | Low | `extractTxid()` / `txidOf()` normalizers | `lib/flow.ts`, `lib/wallet.ts` |
| 6 | BigInt Clarity args break over JSON-RPC to wallets | Medium | Hex-serialize `functionArgs` + post-conditions | `lib/wallet.ts` |
| 7 | Request bursts trip Hiro free-tier 429s | Low | Pre-broadcast-only exponential backoff | `lib/flow.ts` |
| 8 | `wallet-submitted` sentinel instead of a txid | Low | Guard + surface a clear "cancelled" error | `lib/wallet.ts` |

---

## 1. No native multi-recipient split (highest-impact)

**Observed.** `createStrategy({ splitAddress, splitAmount })` routes to exactly **one** recipient.
A savings circle's core move is many-to-one: each round, every other member pays the round's
recipient. With `N` members that's `N−1` payments *into* one person.

**Impact.** We implement each round as `N−1` **sequenced single-splits** — each member sets a split
rule to the recipient, then deposits. For a 3-member circle that's 2 splits/round × 3 rounds = 6
contribution txs, on top of 3 bond splits and 3 bond-returns. It works and every tx is real
on-chain, but it multiplies transaction count, gas, and wall-clock latency, and the round is **not
atomic** — a partial round is an observable intermediate state we have to reason about.

**Proposal.** Accept a recipient list:

```ts
createStrategy({
  splitRecipients: [{ address: A, amount: x }, { address: B, amount: y }],
  // ...existing lock/hold fields
})
```

Even a bounded list (e.g. ≤8) would collapse a whole round to one deposit and make it atomic.

## 2. Single lock bucket per principal

**Observed.** A vault has one `lockedBalance` with one `lockUntilBlock`. You cannot hold two
tranches locked until *different* heights in the same vault.

**Impact.** Our escrow pools every member's bond and locks the total until a single `endBlock`
(`CIRCLE.lockWindowBlocks` from join). Fine for one synchronized circle, but it prevents laddered
locks (e.g. staggered per-member release, or a member being in two circles with different end
dates) without spinning up additional principals.

**Proposal.** Support multiple named lock tranches per principal, or a `locks: [{ amount, untilBlock }]`
list, with `getVaultState` returning them itemized.

## 3. Self-lock only — no third-party clawback (defines the trust model)

**Observed.** Locks are **self-locks**: a principal locks *its own* funds. There is no mechanism for
a third party (an escrow contract) to claw back or redirect a defaulter's locked bond.

**Impact.** This is the single biggest architectural consequence. Because the SDK/contract can't
enforce "if member X defaults, move their bond to the shorted recipient," we route bonds to an
**app-run escrow principal** (a real keypair the backend controls) that custodies bonds and settles
compensation via ordinary splits. We are explicit that this is **trust-minimized, not trustless**
(see `SECURITY.md`). A native escrow primitive would remove the custodial principal entirely.

**Proposal.** See the `circle-escrow` Clarity sketch below — delegated lock authority so a designated
contract can enforce conditional release without holding keys.

## 4. Routing rules apply on the *next* deposit (stateful, easy to get wrong)

**Observed.** `createStrategy(rules)` stores rules that are consumed by the **subsequent** `deposit()`.
Rules and deposit are two separate transactions.

**Impact.** For correctness we must broadcast `set-routing-rules`, **wait for it to confirm**, then
broadcast `deposit` — otherwise the deposit can land before the rules and route incorrectly. This
doubles the tx count on every routed move and forces a confirmation barrier mid-sequence (see the
sequencing note in `lib/circle-engine.ts`). It's also a latent footgun: a naive integrator firing
both without waiting gets non-deterministic behavior.

**Proposal.** Offer an atomic combined call, e.g. `depositWithStrategy(rules, amount)`, that applies
the routing rules to that same deposit in one transaction. This would also make item #1's rounds
one-tx-per-member instead of two.

## 5. Inconsistent txid field across signer modes

**Observed.** The transaction result exposes the id under different keys depending on mode:
`txid` / `txId` / `id` (and occasionally nested). We normalize with `extractTxid()` (senderKey mode)
and `txidOf()` (wallet mode).

**Impact.** Minor, but every integrator will re-implement this. Cost us debugging time because the
happy path returned a value under an unexpected key.

**Proposal.** Return a single, documented shape from every path, e.g. `{ txid: string }`.

## 6. BigInt Clarity args don't survive JSON-RPC to the wallet

**Observed.** In `contractCallExecutor` / `@stacks/connect` (v8) mode, the SDK hands the executor
`functionArgs` as `ClarityValue` objects whose `uint` amounts are **BigInt**. Passing those straight
to `request('stx_callContract', …)` fails with a generic *"Internal error"* — BigInt doesn't survive
the JSON-RPC hop.

**Impact.** Cost real debugging time (the error message gives no hint). Fix was to
`serializeCV(arg)` every function arg and `postConditionToHex(pc)` every post-condition to hex
strings before the wallet call — the canonical JSON-safe wire form (`lib/wallet.ts`).

**Proposal.** Either (a) expose a wallet-ready request variant that pre-serializes args/post-conditions
to hex, or (b) document the required serialization prominently for `@stacks/connect` integrators.

## 7. Request bursts trip Hiro free-tier 429s

**Observed.** Each mutating call fans out into several Hiro requests (fee estimation, nonce fetch,
broadcast). A tight sequence of deposits bursts past the free-tier per-minute quota → HTTP 429,
surfacing as *"Error estimating transaction fee."*

**Impact.** Mid-run failures during the demo. We added `withRateLimitRetry()` — exponential backoff
(8s → 60s cap). **Critical subtlety:** we only retry errors that occur *before* broadcast, because
re-running a broadcast would reuse a nonce and double-spend. The 429s we saw surface at fee
estimation, which is pre-broadcast and therefore safe to retry.

**Proposal.** Add an optional SDK-level retry/backoff, and/or reduce redundant reads per tx.
Document which failure points are pre- vs post-broadcast so integrators can retry safely.

## 8. `wallet-submitted` sentinel instead of a real txid

**Observed.** Wallet-mode results sometimes carry `"wallet-submitted"` rather than a real txid (and
cancellations return no id).

**Impact.** We can't render an explorer link from a sentinel. We guard for it and surface a clear
"the wallet did not return a transaction id (it may have been cancelled)" message.

**Proposal.** Always return the broadcast txid, or a typed pending handle the integrator can resolve.

---

## Proposal: a native `circle-escrow` Clarity extension

Items #1–#3 all trace back to one thing: **rotating-circle semantics can't be expressed on-chain
today**, so an off-chain orchestrator + a custodial principal fill the gap. A small Clarity extension
would make circles fully trustless. Sketch of the interface we'd have built against:

```clarity
;; circle-escrow — conditional, delegated escrow for rotating savings circles.
;; Members grant the circle a delegated lock authority; the contract — not an
;; app-run keyholder — enforces bond custody, payouts, and default compensation.

(define-public (open-circle (members (list 12 principal))
                            (bond uint) (contribution uint) (end-block uint)))

;; Delegated lock: member authorizes the circle to hold their bond until end-block.
(define-public (post-bond (circle uint)))

;; Many-to-one payout for round R — the primitive missing today (#1). Atomic.
(define-public (settle-round (circle uint) (recipient principal)))

;; If a member misses, the contract redirects THEIR bond to the shorted
;; recipient — no third party touches funds (#3).
(define-public (claim-default (circle uint) (defaulter principal)))

;; After end-block, return each non-defaulting member's bond.
(define-public (close-circle (circle uint)))

;; Read model mirrors getVaultState, itemized per circle + per member.
(define-read-only (get-circle (circle uint)))
```

The key idea is **delegated lock authority**: members authorize a specific contract to enforce
conditional release, so bonds are held by *code*, not by a keyholder. That single primitive would
let Sanctuary drop the custodial escrow principal and the off-chain sequencing barrier, and would
generalize to any conditional multi-party flow — payroll, insurance pools, DAO streaming — not just
circles.

---

## What worked well (credit where due)

- **All three primitives compose cleanly.** Lock / Split / Hold genuinely cover a real financial
  instrument end-to-end — we didn't have to fake anything; every step is a real testnet tx.
- **Dual signer modes are excellent.** `senderKey` for backend automation and `contractCallExecutor`
  for browser wallets let us serve *both* a self-driving managed demo and the real-user `/create`
  flow — where members join and fund with their own wallets — from the same code. The wallet join
  reuses the identical create-strategy + deposit move the engine makes.
- **`getVaultState` is the right read model.** `total / locked / unlocked / lockUntilBlock /
  currentBlock` is exactly what an auditable UI needs; our live escrow-proof panel reads straight
  from it.
- **Utils (`tokenToMicro` / `microToToken` / `isValidAddress`) are correct and ergonomic.**

## Verifiable evidence (testnet)

Every claim above is backed by real transactions. A full 3-member circle lifecycle
(3 bonds → escrow lock → 6 contributions → 3 bond-returns = 14 txs). Examples:

- Escrow bond **LOCK** — [`b68df8…a2cf`](https://explorer.hiro.so/txid/0xb68df8994b0c6c777e2b5a835aed06afc45b90e0e5f55f151f3c47ec38f3a2cf?chain=testnet)
- A round **contribution split** — [`978af8…9cfde`](https://explorer.hiro.so/txid/0x978af837a468a3846d37b3a59420d178e3da4257d37575d44775da787679cfde?chain=testnet)
- Final **bond return** — [`31f02c…1d38`](https://explorer.hiro.so/txid/0x31f02cc6b002c6cd61a0f768b246ab52b58d64b1e9ee1793e44acdcec95d1d38?chain=testnet)

Escrow principal: `ST3BBEF5Q148CCEZ14Y0EJDTRAHWMKDEQTJVZ15CT`.
