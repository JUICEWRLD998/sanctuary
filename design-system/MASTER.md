# Sanctuary — Design System (MASTER)

> Global source of truth for all UI. Page-specific overrides live in `design-system/pages/<page>.md`
> and take precedence over this file. If no page file exists, use this Master exclusively.

**Product:** Programmable, Bitcoin-secured savings circles (ROSCA / Susu / Tanda) on Stacks.
**Direction:** **Warm Vault** — a hybrid that fuses Bitcoin-secured *credibility* (on-chain proof,
finality, precise data) with warm *human* diaspora storytelling (member faces, the circle as a
living thing). Premium + human + Bitcoin-credible. Dark, warm base.

**Pattern:** Community/Forum Landing → member showcase, live activity, one prominent Join CTA.
**Stack:** Next.js 14 (App Router, TS) · TailwindCSS · Framer Motion · SVG icons (Lucide).

---

## 1. Color tokens

Dark, *warm* base (warm near-black, NOT cold slate). Gold is the shared anchor — it reads as
Bitcoin-orange, gold/value, and warmth simultaneously. Clay humanizes members; green = confirmed
on-chain.

| Role | Hex | Token | Use |
|------|-----|-------|-----|
| Background | `#17120E` | `--color-bg` | Warm near-black canvas |
| Surface / card | `#211A14` | `--color-surface` | Espresso card (glass over bg) |
| Surface raised | `#2B231B` | `--color-surface-2` | Hover / elevated card |
| Primary (gold) | `#F59E0B` | `--color-primary` | Bitcoin/value, primary CTA, active ring |
| On primary | `#1A1206` | `--color-on-primary` | Text/icon on gold |
| Secondary (amber) | `#FBBF24` | `--color-secondary` | Highlights, gradient partner for gold |
| Member accent (clay) | `#C67B5C` | `--color-accent` | Member avatars, human touch |
| Success (green) | `#22C55E` | `--color-success` | Confirmed on-chain, "live" pulse (AA on dark) |
| Foreground | `#F8F3EC` | `--color-fg` | Warm ivory body text |
| Muted foreground | `#B8AA98` | `--color-fg-muted` | Secondary text, captions (≥4.5:1 on bg) |
| Border | `#3A2F24` | `--color-border` | Warm hairline dividers |
| Destructive | `#EF4444` | `--color-destructive` | Default/missed round, errors |
| Ring (focus) | `#F59E0B` | `--color-ring` | Focus outline (2px) |

**Gradients:** gold→amber (`#F59E0B → #FBBF24`) for balances/CTAs only. Warm radial glow behind the
avatar ring. **No purple/pink** (explicit anti-pattern for this product).

**Contrast checks (must hold):** `--color-fg` on `--color-bg`, `--color-fg-muted` on `--color-bg`,
and `--color-on-primary` on `--color-primary` all ≥ 4.5:1. Green/red status also carry an
icon + text label (never color alone).

---

## 2. Typography

- **Display / headings:** Space Grotesk (500/600/700) — precise, techy-but-humanist.
- **Body / UI:** Inter (400/500/600).
- **Data / numbers / txids:** JetBrains Mono (400/500) — **tabular figures** for amounts, block
  heights, countdowns, and truncated txids so nothing shifts as values change.
- **Scale:** 12 · 14 · 16 · 20 · 24 · 32 · 48. Body 16px min. Line-height 1.5 body / 1.15 display.
- **Weight hierarchy:** headings 600–700, labels 500, body 400.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap');
```

---

## 3. Effects & shape

- **Radius:** cards 16px (`--radius-lg`), inputs/buttons 12px, pills/badges full.
- **Elevation (consistent scale):**
  - card: `0 1px 0 rgba(255,255,255,.03) inset, 0 8px 24px rgba(0,0,0,.45)`
  - gold CTA glow: `0 0 0 1px rgba(245,158,11,.35), 0 8px 30px rgba(245,158,11,.25)`
- **Glass:** surfaces use a subtle warm translucency + `backdrop-blur` for nav/sheets **only** (blur
  signals dismissible layers, not decoration). Keep it light — perf-sensitive.
- **Live indicators:** pulsing green dot for an active/streaming state; gold shimmer on the current
  recipient in the ring.

---

## 4. Motion (Framer Motion; tier: Standard, motion=7/10)

- Micro-interactions 150–300ms; view/section transitions ≤400ms. Exit ≈ 60–70% of enter.
- `ease-out` entering, `ease-in` exiting; spring for the pot-flow and avatar ring.
- **Animate `transform`/`opacity` only** — never width/height/top/left (no CLS).
- Stagger list/timeline items 30–50ms.
- **Signature moment:** the pot visibly *flows* along the ring to the current recipient when a round
  settles; recipient avatar scales 1.0→1.05 and gold-glows; amount counts up (tabular mono).
- Respect `prefers-reduced-motion`: disable the flow/parallax, keep state readable instantly.

---

## 5. Component intents (Phase 3)

- **CircleRing** — avatars arranged on a ring; connecting arcs; pot token animates to recipient each
  round; center shows pot size + round X/N + block countdown. One primary focus per view.
- **RoundTimeline** — vertical ledger of rounds/events; each row: kind badge, human label, amount
  (mono), and an explorer link (opens txid). Default/compensation rows use destructive/gold accents
  with icon + text.
- **MemberCard** — avatar (clay ring), name + city, reason ("school fees"), streak, bond status.
- **StreakBar** — segmented contribution history; green = paid, red = missed (icon, not color-only).
- **BitcoinBadge** — "Secured by Bitcoin finality" trust chip; gold, with a lock/BTC glyph.
- **Primary CTA** — one per screen (Join / Run autopilot). Gold gradient + glow. Loading → spinner +
  disabled during async; success → brief green confirm.

---

## 6. Non-negotiables (from UX rules)

- Accessibility: 4.5:1 text, visible 2px gold focus rings, aria-labels on icon-only buttons,
  keyboard nav, color never the sole signal.
- Touch: targets ≥44px, ≥8px spacing; explorer links and ring avatars are comfortably tappable.
- Performance: WebP/AVIF avatars with reserved `width/height`; `font-display: swap`; lazy-load
  below-the-fold; skeletons for the live circle while `api/circle` loads (>300ms).
- Responsive: mobile-first at 375 / 768 / 1024 / 1440; ring reflows to a stacked layout on mobile;
  no horizontal scroll; `min-h-dvh`.
- Data: mono tabular figures for all on-chain numbers; every event keeps its explorer link.

## 7. Avoid (anti-patterns)

- Purple/pink "AI" gradients · emoji as icons · playful/childish styling · cold pure-slate `#0F172A`
  (use the *warm* `#17120E`) · unclear/hidden fees or amounts · color-only status · animating layout
  properties · more than one primary CTA per screen.
