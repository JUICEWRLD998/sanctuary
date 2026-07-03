# FlowVault Integration — how Sanctuary uses the SDK

> **Sanctuary** is a rotating savings circle (ROSCA / susu / tanda / "committee") built **entirely**
> from FlowVault's three primitives — **Lock, Split, Hold** — with no other on-chain money movement.
> Every contribution, bond, lock, and payout is a real `flowvault-sdk` call producing a verifiable
> Stacks testnet transaction. This document maps the financial mechanic → the primitive → the code.

**SDK:** `flowvault-sdk@0.1.2` · **Contract:** `flowvault-v2` · **Token:** `usdcx` (6 decimals) ·
**Network:** Stacks testnet.

---

## 1. The mental model

A savings circle: `N` members each contribute a fixed amount every round; each round the **whole
pot** rotates to one member. Members post a **commitment bond** up front so nobody can walk away
mid-circle. Sanctuary expresses this as:

| Circle mechanic | FlowVault primitive | SDK move |
|-----------------|---------------------|----------|
| Post commitment bond → escrow | **SPLIT** | `createStrategy({ splitAddress: escrow, splitAmount: bond })` → `deposit(bond)` |
| Escrow secures the pooled bonds | **LOCK** | `createStrategy({ lockAmount: Σbonds, lockUntilBlock: endBlock })` → `deposit(Σbonds)` |
| Round payout (many-to-one) | **SPLIT** (sequenced) | each non-recipient: `createStrategy({ splitAddress: recipient, splitAmount: contribution })` → `deposit(contribution)` |
| Liquidity buffer | **HOLD** | unlocked balance; surfaced from `getVaultState().unlockedBalance` |
| Default compensation | **SPLIT** (escrow) | escrow splits the shorted recipient whole from the defaulter's bond |
| Bond return on completion | **SPLIT** (escrow) | escrow returns each bond after lock expiry |

All three primitives are **load-bearing** — remove any one and the instrument breaks. That is by
design: the bounty rewards new behaviors that genuinely need programmable routing, and a circle is
one that does.

---

## 2. Where it lives in code

```
lib/
  constants.ts       # contract targets, circle economics (bond, contribution, lock window)
  flow.ts            # thin typed wrappers over flowvault-sdk  (senderKey / backend mode)
  wallet.ts          # browser signing bridge                 (contractCallExecutor mode)
  members.ts         # the members + escrow, addresses derived from keys
  circle-engine.ts   # the state machine that composes Lock/Split/Hold into a circle
  ledger.ts          # JSON persistence of rounds + txids
app/api/
  orchestrator/route.ts  # POST — drives the managed circle (server-only signing)
  circle/route.ts        # GET  — reads live circle + escrow state for the UI
```

The engine (`lib/circle-engine.ts`) is deliberately a **reusable layer**: a documented TypeScript
state machine over `flowvault-sdk` that anyone could fork to build their own circle variant.

---

## 3. The core SDK call — set strategy, then deposit

FlowVault "programs" money by storing routing rules that are applied on the **next** deposit. Our
single wrapper captures both halves (`lib/flow.ts`):

```ts
export async function setStrategyAndDeposit(vault, strategy, depositAmount) {
  const rules = {
    lockAmount:     tokenToMicro(strategy.lock ?? "0"),
    lockUntilBlock: strategy.lockUntilBlock ?? 0,
    splitAddress:   strategy.splitAddress ?? null,
    splitAmount:    tokenToMicro(strategy.split ?? "0"),
  };
  const strategyTx = { txid: extractTxid(await vault.createStrategy(rules)) };
  const depositTx  = { txid: extractTxid(await vault.deposit(tokenToMicro(depositAmount))) };
  return { strategyTx, depositTx };
}
```

**Sequencing matters.** Because rules apply on the *next* deposit, the engine broadcasts
`set-routing-rules`, **waits for it to confirm**, then broadcasts `deposit`. Same-sender txs are thus
strictly ordered, which also keeps nonces clean. This is why a real run takes minutes (it waits on
block confirmations) — and why every tx in the demo is genuine rather than mocked. (See
`FLOWVAULT_FEEDBACK.md §4` for why we'd prefer an atomic combined call.)

---

## 4. Two signer modes, one behavior

Sanctuary uses **both** of the SDK's signing modes, and crucially they perform the *same* on-chain
move so the demo and the real-user path are identical:

### a) Backend automation — `senderKey` (`lib/flow.ts`)

```ts
new FlowVault({ network: "testnet", senderKey, ...contracts })
```

Drives the managed 3-member demo circle end-to-end (the "Run the circle live" autopilot). Keys are
**server-only** (see `SECURITY.md`) and never reach the browser.

### b) Browser wallet — `contractCallExecutor` (`lib/wallet.ts`)

```ts
new FlowVault({ network: "testnet", senderAddress, contractCallExecutor: executor, ...contracts })
```

Lets a judge **join a round with their own wallet** (Leather / Xverse) via `@stacks/connect` v8. The
executor bridges the SDK's request onto `request('stx_callContract', …)`, hex-serializing Clarity
args + post-conditions first (required — see `FLOWVAULT_FEEDBACK.md §6`). The judge signs the exact
same SPLIT-to-escrow → deposit that the managed engine makes — no private key ever leaves the wallet.

---

## 5. The auditable read model

The UI's live "Escrow vault" proof panel reads straight from `getVaultState` (`lib/flow.ts`):

```ts
const s = await vault.getVaultState(address);
// → { total, locked, unlocked, lockUntilBlock, currentBlock }  (converted to whole USDCx)
```

This is what makes the escrow's bond-lock **auditable in real time**: anyone can watch
`lockedBalance` = Σ bonds until `endBlock`, then drain to zero as bonds return. Every recorded event
also carries its Hiro explorer link.

---

## 6. Verifiable on-chain proof (testnet)

A complete 3-member circle lifecycle = **14 real transactions**: 3 bond splits → 1 escrow lock →
6 contribution splits → 3 bond returns. Escrow principal
`ST3BBEF5Q148CCEZ14Y0EJDTRAHWMKDEQTJVZ15CT`.

| Step | Primitive | Transaction |
|------|-----------|-------------|
| Bond → escrow | SPLIT | [`80e607…1e92`](https://explorer.hiro.so/txid/0x80e607e240b42ca5dd8e8cee6f3e85b375ddf00e14e358916bf13409f9461e92?chain=testnet) |
| Escrow locks bonds | LOCK | [`b68df8…a2cf`](https://explorer.hiro.so/txid/0xb68df8994b0c6c777e2b5a835aed06afc45b90e0e5f55f151f3c47ec38f3a2cf?chain=testnet) |
| Round payout | SPLIT | [`978af8…9cfde`](https://explorer.hiro.so/txid/0x978af837a468a3846d37b3a59420d178e3da4257d37575d44775da787679cfde?chain=testnet) |
| Bond return | SPLIT | [`31f02c…1d38`](https://explorer.hiro.so/txid/0x31f02cc6b002c6cd61a0f768b246ab52b58d64b1e9ee1793e44acdcec95d1d38?chain=testnet) |

A separate `default-demo` circle additionally proves the compensation path (a member misses a round;
the escrow makes the shorted recipient whole from the defaulter's forfeited bond and its books drain
to exactly zero) — see `FLOWVAULT_FEEDBACK.md` and the `phase2:default` script.

---

## 7. Honesty note

FlowVault v2 is per-principal with self-locks only and no native multi-recipient split, so the
circle's many-to-one payouts and third-party bond custody require an **off-chain orchestrator** and
an **app-run escrow principal**. We present the escrow as a **trust-minimized coordinator, not
trustless**, run on **testnet only**. `SECURITY.md` details the trust boundary and
`FLOWVAULT_FEEDBACK.md` proposes the Clarity extension that would make it fully trustless.
