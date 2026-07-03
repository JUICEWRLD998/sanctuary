# Security & Trust Model — Sanctuary

> Sanctuary moves real (testnet) value through FlowVault. This document states the trust boundary
> **honestly**, the key-custody rules, the on-chain safety measures, and the invariants the engine
> enforces. We describe the escrow as **trust-minimized, not trustless** — and say exactly why.

**Scope:** Stacks **testnet only**. No mainnet keys, no mainnet value, ever.

---

## 1. Trust model in one paragraph

FlowVault v2 uses **self-locks** — a principal can only lock *its own* funds — and there is **no
third-party clawback**. A savings circle needs the opposite: someone must hold every member's bond
and be able to redirect a defaulter's bond to the person they shorted. Since the contract can't
enforce that, Sanctuary routes bonds to an **app-run escrow principal** (a real testnet keypair the
backend controls) that custodies bonds and settles compensation and returns via ordinary splits.
That principal is a **trusted coordinator**. We minimize what it can do and make everything it does
publicly auditable, but we do **not** claim it is trustless. `FLOWVAULT_FEEDBACK.md` proposes the
Clarity `circle-escrow` extension that would remove this trusted party entirely.

**What the escrow can and cannot do:**

- **Can:** hold pooled bonds, lock them until `endBlock`, split compensation/returns after expiry.
- **Cannot (by construction):** dip into other members' bonds beyond a defaulter's own bond — the
  engine's over-default guard (§4) makes its books provably drain to zero.

---

## 2. Key custody

| Key | Holder | Scope | Guard |
|-----|--------|-------|-------|
| `ESCROW_KEY` | Server env only | Escrow principal signing | `lib/env.ts` throws if imported client-side |
| `MEMBER_1..3_KEY` | Server env only | Managed demo members (autopilot) | same |
| Judge's wallet key | The judge's wallet | Wallet-join path | **never leaves the wallet** — `@stacks/connect` |

Rules enforced in code:

- **Server-only module boundary.** `lib/env.ts` and `lib/flow.ts` are server-only. `lib/env.ts`
  literally throws if `typeof window !== "undefined"`, so a signing key can never be bundled into
  client JS. The read model (`getVaultState`) and all story data are client-safe and key-free.
- **No keys in the repo.** Keys come from `.env.local` only, which is gitignored. `.env.example`
  ships blank placeholders and a "testnet keys only, never mainnet" banner.
- **Fail-closed signing.** The orchestrator refuses to act unless every managed key is present,
  returning a precise error naming the missing variables (`requireServerEnv()`), rather than
  silently partially-signing.
- **Managed keys are demo-only.** They exist so judges can watch the full lifecycle fire without
  needing three funded wallets. They are testnet accounts holding a few USDCx — no value at risk.

---

## 3. On-chain safety measures

- **Post-conditions.** Transactions carry FlowVault's post-conditions; the wallet path forwards them
  (`postConditionToHex`) so the user's wallet can enforce "no more than this leaves my account." We
  never blanket-`allow` where a `deny` post-condition applies.
- **Amount discipline.** All amounts are whole USDCx strings converted through `tokenToMicro` at the
  single boundary (`lib/flow.ts`, `lib/wallet.ts`) — the backend and wallet paths use the *identical*
  conversion, so a judge signs the same micro-amount the engine would.
- **Address validation.** Recipient/escrow principals are validated before use; strategies never
  split to an empty/invalid address.
- **Explicit lock horizon.** The escrow lock uses an absolute `lockUntilBlock` (`endBlock`) read from
  chain state, not a relative guess — the UI shows the live block countdown so the lock is auditable.

---

## 4. Correctness invariants (unit-tested)

The engine is covered by Vitest (`tests/`), asserting the properties that make the money math safe:

- **Pot conservation** — each recipient receives exactly `(N−1) × contribution`; nothing is created
  or destroyed (`circle-math`).
- **Escrow books balance to zero** — `Σ compensation + Σ bond-returns === Σ pooled bonds`. The escrow
  never ends a circle holding or owing value (`circle-default`).
- **Over-default guard** — a member cannot default beyond what their own bond covers (with
  `bond == contribution`, at most one miss). This is what guarantees the escrow never dips into other
  members' bonds. Rejected at the engine, before any tx is signed.
- **Full lifecycle** — join → rounds → complete drives to `phase: "complete"` with a consistent
  ledger (`circle-engine`).

Result: **13/13 tests green**, and the invariants are also asserted **live on-chain** by the
`phase1:run` and `phase2:default` scripts (which read the real escrow vault after a run and confirm
it drained to zero).

---

## 5. Transaction-broadcast safety (no double-spend on retry)

Hiro's free-tier API can return `429` mid-run because the SDK fans out several requests per tx. We
retry with exponential backoff — but **only errors that occur before broadcast** (fee estimation,
nonce fetch). Re-running a *broadcast* would reuse a nonce and double-spend, so `withRateLimitRetry`
is applied only where the failure is provably pre-broadcast (`lib/flow.ts`). This is a deliberate,
documented safety boundary, not a blanket retry.

---

## 6. What is explicitly out of scope (MVP, honestly stated)

- **Not trustless** — the escrow principal is a trusted coordinator (see §1). Roadmap: native Clarity
  escrow.
- **Testnet only** — no mainnet path exists; managed keys are testnet accounts.
- **No auth / multi-tenant / multi-circle management** — single demo circle by design.
- **JSON-file ledger, not a database** — fine for a demo, not for production durability/concurrency.
- **No formal audit** — this is a bounty MVP; the Clarity extension in `FLOWVAULT_FEEDBACK.md` is the
  component that would warrant one before any real value moves.

---

## 7. Reporting

This is a testnet demo with no real value at risk. If you find an issue in the engine logic or trust
model, please open a GitHub issue — the trust boundary above is intended to be adversarially
reviewed, and clarifications are welcome.
