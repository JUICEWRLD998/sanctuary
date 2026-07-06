# Real-User Savings Circles — Build Plan (`createcircle`)

> **Goal:** Let a real group form and run their own savings circle on Stacks testnet —
> variable size, real wallets as members, each entering their own name + what they're
> saving for — while leaving the existing demo (`/circle/demo`, managed autopilot)
> **completely untouched**.

## Decisions (locked)

- **Signing/custody model: "Fund upfront, escrow auto-rotates."**
  Each member funds `bond + (memberCount − 1) × contribution` into the escrow in one
  signed move at join. Because the escrow then holds all the money, every rotation and
  bond-return is signable by the single server-held `ESCROW_KEY` — real members sign only
  once (at join, in their own wallet); the escrow drives the rest. This keeps it both
  *real* (self-custody until join) and *self-driving*.
- **Scope: Add alongside the demo.** `/circle/demo` and the managed autopilot stay as-is
  for the demo video. The real-user flow is new surface area.

## Key economics

- Members: `N` (`capacity`). Rounds: `N`.
- Per-member upfront deposit = `bond + (N − 1) × contribution`.
- Each round the escrow pays the recipient `(N − 1) × contribution`.
- Each member receives once; over the circle each member's contributions net against their
  one payout; bonds return at completion (minus any default shortfall).

## Progress checklist

- [ ] **1. Data model** — `lib/ledger.ts`
- [ ] **2. Engine** — `lib/open-circle.ts` (new; demo `circle-engine.ts` untouched)
- [ ] **3. Client funding** — `lib/wallet.ts`
- [ ] **4. API routes** — `/api/open/create`, `/api/open/join`, `/api/open/advance`; tweak `/api/circle`
- [ ] **5. UI** — `app/create/page.tsx`, `components/LobbyJoin.tsx`, `app/circle/[id]/page.tsx`, landing link
- [ ] **6. Tests** — `tests/open-circle.test.ts`
- [ ] **7. Docs** — `DEMO.md` / `README.md`

---

## 1. Data model — `lib/ledger.ts` (additive, backward-compatible)

- New `CircleMember { id, address, name, purpose, fundTxid, joinedAt }`.
- Extend `CircleState` with optional fields: `kind?: "managed" | "open"`, `title?: string`,
  `capacity?: number`, `members?: CircleMember[]`.
- New event kinds: `member-join`, `circle-form`.
- Existing `demo` / `live` JSON files load unchanged (new fields absent → treated as
  `managed`).

## 2. New engine — `lib/open-circle.ts`

Separate module so the demo's `circle-engine.ts` is not destabilized.

- `createOpenCircle({ id, title, capacity, contribution, bond })` → phase `forming`, empty roster.
- `recordMember({ id, address, name, purpose, fundTxid })` → verify the fund txid succeeded
  on-chain (Hiro), reject duplicate address / over-capacity, append member. When roster
  fills → auto-call `form()`.
- `form()` → escrow LOCKs the pooled bonds until `endBlock`; set (randomized) payout order;
  phase → `active`.
- `advanceOpenCircle()` → escrow-signed rotation: each round the escrow SPLITs the pot
  `(N − 1) × contribution` to the round recipient; after the last round + lock expiry,
  returns each bond to its member's own address. Reuses `routedDeposit` / `confirm` helpers
  from the existing flow layer.

## 3. Client funding — extend `lib/wallet.ts`

- `fundCircleJoin(vault, escrow, total)` — same confirmed `setStrategy → deposit` pair
  `ConnectJoin` already uses, but amount = full upfront obligation
  (`bond + (N − 1) × contribution`). No new signing mechanics; the UI also captures
  name + purpose.

## 4. API routes

- `POST /api/open/create` — create a lobby (ledger-only, no keys needed).
- `POST /api/open/join` — `{ id, address, name, purpose, fundTxid }`; verify + record
  member, auto-form when full.
- `POST /api/open/advance` — drive the escrow rotation/completion (needs `ESCROW_KEY`);
  mirrors the existing `AutopilotButton` → `/api/orchestrator` pattern.
- `GET /api/circle` — one small change: return `circle.members ?? MEMBER_PROFILES` so both
  managed and open circles render.

## 5. UI

- `app/create/page.tsx` — organizer form (title, size, contribution, bond) → creates
  circle → routes to `/circle/[id]`.
- `components/LobbyJoin.tsx` — connect wallet, enter **name + what you're saving for**,
  fund upfront, POST to `/api/open/join`; shows "3 of 5 joined."
- `app/circle/[id]/page.tsx` — render a **lobby state** (filling roster + join card) when
  `forming` & `open`; fall through to the existing hero for `active` / `complete`.
  Purposes come from the dynamic members.
- Landing (`app/page.tsx`) — add a quiet "Start your own circle" link to `/create`.

## 6. Tests — `tests/open-circle.test.ts`

Full open lifecycle (create → joins → form → rotate → complete), value-conservation
invariants, and guards (duplicate address, over-capacity, advance-before-full).

## 7. Docs

Add a short section to `DEMO.md` / `README.md` explaining open circles and noting they lean
on the same escrow-trust model (Model A) that the existing Clarity `circle-escrow` proposal
removes.

## Honest constraints (unchanged, disclosed)

Still testnet-only; the escrow custodies funds during rotation (inherent to "fund upfront,
auto-rotate") — the same trust-minimized-not-trustless posture already documented. The
`circle-escrow` Clarity proposal remains the path to removing that trust.

## Build order

Data model → engine → client funding → API → UI → tests → docs. Run `npm test` and
`npm run typecheck` as we go.
