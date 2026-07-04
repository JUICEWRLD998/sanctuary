# Sanctuary — Demo Video Script

> Target length **≤ 3:00**. Spoken word count ~430 (≈150 wpm). Every transaction shown
> is real on Stacks testnet — click-throughs to the Hiro explorer are the whole point.
> **Setup before recording:** `npm run dev`, open the landing (`/`) and the live circle
> (`/circle/demo`, already seeded to `phase: complete`) in two tabs. Have a Leather/Xverse
> wallet on testnet ready for the optional join beat. Screen at 1080p, cursor visible.

---

## 0:00 – 0:20 · The hook (landing hero)

**On screen:** landing page hero.

> "A billion people already save with rotating savings circles — susu, tanda, committee,
> chama. Everyone pays in each round, and each round the whole pot goes to one person.
> It moves hundreds of billions a year, entirely on trust. This is **Sanctuary** — that
> same tradition, now self-driving and secured by Bitcoin."

---

## 0:20 – 0:45 · How it works (scroll the explainer)

**On screen:** slow-scroll through the three-step "how a circle works" section, then the
three real people (Amara / Chidi / Fatima) with their reasons.

> "The rules are simple. Everyone pays in the same small amount and locks a commitment
> bond up front, so no one can walk away mid-circle. Each round the entire pot routes to
> one member — a lump sum, exactly when they need it. And every move settles on Stacks
> with Bitcoin finality. Meet the circle: Amara in Lagos saving school fees, Chidi in
> London for a rent deposit, Fatima in Nairobi for a fridge for her shop."

---

## 0:45 – 1:05 · The honest architecture

**On screen:** cut to the live circle page (`/circle/demo`), the escrow proof panel visible.

> "Under the hood this maps onto FlowVault's three primitives — **Lock, Split, and Hold**.
> To join, each member **splits** their bond into an app-run escrow, which then **locks**
> every bond until the circle ends — that's the trust anchor. Each round is a sequence of
> **splits** that routes the pot to the current recipient. It's a real orchestration engine,
> not a deposit UI."

---

## 1:05 – 2:00 · Watch a real circle run (the centerpiece)

**On screen:** the seeded completed circle — the CircleRing with the pot flowing to each
recipient, and the RoundTimeline. Click into one or two explorer links as you narrate.

> "Here's a full circle that already ran — end to end, on testnet. Three bonds split into
> escrow. The escrow locks them until the end block — here's that lock transaction on the
> explorer *(click the escrow-lock link)* — real, confirmed, anchored to Bitcoin. Then the
> rounds fire: round one, everyone contributes and the whole pot lands on Amara — her
> school fees, paid. Round two rotates to Chidi. Round three to Fatima. When the lock
> expires the escrow reclaims and returns every bond, and the books drain to exactly zero.
> That's **fourteen real on-chain transactions** — every one of them a clickable, auditable link."

**Tip:** pause on the "escrow vault drained to 0" proof panel — say *"you can verify the
escrow holds nothing at the end — no funds left our hands."*

---

## 2:00 – 2:30 · Defaults are handled (credibility beat)

**On screen:** briefly show / mention the default-compensation path (or the test output).

> "And it's robust. If someone misses a round, the escrow makes the shorted recipient whole
> from the defaulter's forfeited bond — and only that. Everyone else's bond is untouched,
> and the math is unit-tested and proven on-chain. The circle keeps its promise even when a
> member doesn't."

---

## 2:30 – 2:50 · Join it yourself (optional live wallet beat)

**On screen:** the ConnectJoin sidebar — connect wallet, show USDCx balance.

> "This isn't just automated accounts. Connect your own wallet and join a round — you sign
> the same split-then-deposit the engine does, and your transaction lands on the explorer
> right next to the rest."

*(If not doing a live sign on camera, keep this to the connect step and the balance read.)*

---

## 2:50 – 3:00 · Close

**On screen:** back to the landing closing panel.

> "A billion people already save this way. Sanctuary keeps the trust and the ritual — and
> adds what was always missing: bonds that can't quietly vanish, and a ledger anyone can
> check. Built on FlowVault, secured by Bitcoin. Thanks for watching."

---

## Reference facts (keep accurate on camera)

- **Live circle:** 3 members — Amara, Chidi, Fatima — `contribution = 1 USDCx`, `bond = 1 USDCx`,
  payout order Amara → Chidi → Fatima.
- **14 real on-chain transactions** in the completed `demo` circle (3 bonds → escrow lock →
  6 contributions → escrow reclaim → 3 bond returns). The 3 "payout" entries in the ledger
  (17 events total) are aggregate markers — the pot landing *is* the sum of that round's
  contributions, so they carry no separate txid.
- **All three FlowVault primitives** used: Lock (escrow bond lock), Split (bond → escrow,
  rotating payouts, compensation, bond return), Hold (liquid contribution buffers).
- **Everything is testnet**, anchored to Bitcoin via Stacks; explorer base
  `https://explorer.hiro.so/txid/<id>?chain=testnet`.
- **Escrow ends at zero** — every bond returned (or forfeited to compensation on default).

## Don'ts

- Don't call the escrow "trustless" — say **trust-minimized coordinator** (Clarity-escrow
  roadmap is in `FLOWVAULT_FEEDBACK.md`).
- Don't claim multi-recipient split / native clawback — FlowVault v2 is per-principal;
  the orchestration sequences single splits over blocks.
- Don't show or read any private keys / `.env.local`.
