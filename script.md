# Sanctuary — Demo Video Script

> Target length **≤ 3:00**. Spoken word count ~440 (≈150 wpm). Every transaction shown is real on
> Stacks testnet — the click-throughs to the Hiro explorer are the whole point.
>
> **Setup before recording:** `npm run dev`. Open two tabs — the landing (`/`) and the completed
> circle (`/circle/demo`, already seeded to `phase: complete`). For the create beat, have `/create`
> ready, plus a Leather / Xverse wallet on **testnet** funded with USDCx if you want to sign a real
> join on camera. Screen at 1080p, cursor visible. Never show `.env.local` or any private key.

---

## 0:00 – 0:20 · The hook (landing hero)

**On screen:** landing page hero.


> "A billion people already save with rotating savings circles — susu, tanda, committee, chama.
> Everyone pays in each round, and each round the whole pot goes to one person. It moves hundreds of
> billions a year, entirely on trust. This is **Sanctuary** — that same tradition, now self-driving
> and secured by Bitcoin."

---

## 0:20 – 0:45 · How it works (scroll the explainer)

**On screen:** slow-scroll through the three-step "How a circle works" section, then the three
people — Amara / Chidi / Fatima — with their reasons.

> "The rules are simple. Everyone pays in the same small amount and locks a commitment bond up front,
> so no one can walk away mid-circle. Each round the entire pot routes to one member — a lump sum,
> exactly when they need it. And every move settles on Stacks with Bitcoin finality. Meet a circle:
> Amara in Lagos saving school fees, Chidi in London for a rent deposit, Fatima in Nairobi for a
> fridge for her shop."

---

## 0:45 – 1:05 · The honest architecture (three primitives)

**On screen:** cut to `/circle/demo`, the escrow proof panel visible.

> "Under the hood, this is built entirely from FlowVault's three primitives — **Lock, Split, and
> Hold**. To join, each member **splits** their bond into an app-run escrow, which then **locks**
> every bond until the circle ends — that's the trust anchor. Each round is a sequence of **splits**
> that routes the pot to the current recipient. It's a real orchestration engine, not a deposit UI."

---

## 1:05 – 1:55 · Watch a real circle run (the centerpiece)

**On screen:** the completed `demo` circle — the CircleRing with the pot flowing to each recipient,
and the RoundTimeline. Click into one or two explorer links as you narrate.

> "Here's a full circle that already ran, end to end, on testnet. Three bonds split into escrow. The
> escrow locks them until the end block — here's that lock transaction on the explorer *(click the
> escrow-lock link)* — real, confirmed, anchored to Bitcoin. Then the rounds fire: round one, everyone
> contributes and the whole pot lands on Amara — her school fees, paid. Round two rotates to Chidi.
> Round three to Fatima. When the lock expires, the escrow reclaims and returns every bond, and the
> books drain to exactly zero. That's **fourteen real on-chain transactions** — every one a clickable,
> auditable link."

**Tip:** pause on the "Escrow vault" panel drained to 0 — *"you can verify the escrow holds nothing
at the end. No funds left our hands."*

---

## 1:55 – 2:20 · Defaults are handled (credibility beat)

**On screen:** briefly mention / show the default-compensation path (or the `npm run phase2:default`
test output).

> "And it's robust. If someone misses a round, the escrow makes the shorted recipient whole from the
> defaulter's forfeited bond — and only that. Everyone else's bond is untouched, and the math is
> unit-tested and proven on-chain. The circle keeps its promise even when a member doesn't."

---

## 2:20 – 2:50 · Start your own circle (the real product)

**On screen:** the `/create` page — set a name, member count, contribution, and bond; create it;
show the shareable invite link, then the lobby with its join card.

> "That was our demo circle, driven by managed accounts. But anyone can start a real one. On the
> create page you set the shape — how many members, the contribution, the bond — and you get a link
> to share. Each member opens it, connects **their own** wallet, and funds their share upfront —
> signing the exact same split-then-deposit, with no private key ever leaving their wallet. When the
> last seat fills, the bonds lock and the pot starts rotating on its own. Same primitives, real users,
> real money."

*(If signing live on camera: connect the wallet, show the USDCx balance, and let one join transaction
land on the explorer. Otherwise keep it to the create form and the invite-link handoff.)*

---

## 2:50 – 3:00 · Close

**On screen:** back to the landing's closing panel.

> "A billion people already save this way. Sanctuary keeps the trust and the ritual — and adds what
> was always missing: bonds that can't quietly vanish, and a ledger anyone can check. Built on
> FlowVault, secured by Bitcoin. Thanks for watching."

---

## Reference facts (keep accurate on camera)

- **Two surfaces:** `/circle/demo` (a **completed** managed circle — the always-works proof) and
  `/create` (the **real-user** flow — anyone starts a circle, members join with their own wallets).
- **Demo circle:** 3 members — Amara, Chidi, Fatima — `contribution = 1 USDCx`, `bond = 1 USDCx`,
  payout order Amara → Chidi → Fatima.
- **14 real on-chain transactions** in the completed `demo` circle (3 bonds → escrow lock →
  6 contributions → escrow reclaim → 3 bond returns). The 3 "payout" entries in the ledger are
  aggregate markers — a round's pot landing *is* the sum of that round's contributions, so they carry
  no separate txid.
- **All three FlowVault primitives** used: Lock (escrow bond lock), Split (bond → escrow, rotating
  payouts, compensation, bond return), Hold (liquid contribution buffers).
- **Create flow:** each member funds `bond + (N−1) × contribution` upfront into the escrow; the escrow
  auto-rotates once the roster is full. Needs only `ESCROW_KEY` server-side; members self-sign.
- **Everything is testnet**, anchored to Bitcoin via Stacks. Explorer base:
  `https://explorer.hiro.so/txid/<id>?chain=testnet`.
- **Escrow ends at zero** — every bond returned (or forfeited to compensation on default).

## Don'ts

- Don't call the escrow "trustless" — say **trust-minimised coordinator** (the Clarity-escrow roadmap
  is in `FLOWVAULT_FEEDBACK.md`).
- Don't claim multi-recipient split or native clawback — FlowVault v2 is per-principal; the
  orchestration sequences single splits over blocks.
- Don't show or read any private keys / `.env.local`.
