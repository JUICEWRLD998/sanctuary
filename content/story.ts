/**
 * content/story.ts — the human narrative layer (implementation.md §4).
 *
 * Sanctuary reframes the rotating savings circle (ROSCA / susu / tanda /
 * "committee") that ~1B+ unbanked people already run on trust — as programmable,
 * Bitcoin-secured money. This copy carries the emotional weight the visuals hang
 * on. Kept separate from components so it can be tuned without touching UI.
 */

export const STORY = {
  eyebrow: "Susu · Tanda · Committee — reimagined on Bitcoin",
  headline: "The oldest way to save, now self-driving and secured by Bitcoin.",
  subhead:
    "A rotating savings circle: everyone pays in each round, and each round the whole pot goes to one member. A tradition a billion people already trust — now running on-chain, where the bonds are locked and every move is auditable.",
  proof:
    "This isn't a mock-up. Every contribution, lock, and payout below is a real transaction on the Stacks testnet, anchored to Bitcoin — click any link to verify it on the explorer.",
} as const;

/** Per-member line shown when their pot lands ("the outcome reveal"). */
export const OUTCOMES: Record<string, string> = {
  Amara: "Amara's pot covers her daughter's school fees — paid in full, this round.",
  Chidi: "Chidi's pot lands: the first month's rent deposit, secured.",
  Fatima: "Fatima's pot arrives — the refrigerator for her shop is within reach.",
  Marco: "Marco's pot lands: the tools to start contracting on his own.",
  Priya: "Priya's pot covers the visa application fee — the paperwork can begin.",
  Kwame: "Kwame's pot arrives in time for market week's seed stock.",
};

/**
 * The three-step explainer for the landing. Deliberately human-first, but each
 * step maps to a FlowVault primitive: bond (SPLIT→escrow) + LOCK, rotating
 * payout (sequenced SPLIT), settlement (Bitcoin finality via Stacks).
 */
export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Everyone pays in",
    body: "Each round, every member contributes the same small amount — and locks a commitment bond up front, so no one can walk away mid-circle.",
  },
  {
    step: "02",
    title: "The pot rotates",
    body: "Each round the entire pot routes to one member — a lump sum, exactly when they need it. Next round, the next person. Everyone gets their turn.",
  },
  {
    step: "03",
    title: "Secured by Bitcoin",
    body: "Every contribution, lock, and payout is a real transaction on Stacks, settled with Bitcoin finality — irreversible, and auditable by anyone.",
  },
] as const;

/** A person in the demo circle — client-safe story data (no key material). */
export interface Person {
  /** Matches lib/members MEMBER_PROFILES id, so avatars render consistently. */
  id: number;
  name: string;
  city: string;
  reason: string;
  outcome: string;
}

/**
 * The humans of the demo circle, for the landing story. Mirrors the funded
 * members in lib/members.ts (Amara/Chidi/Fatima); kept here so the landing needs
 * no server-only imports.
 */
export const PEOPLE: readonly Person[] = [
  { id: 0, name: "Amara", city: "Lagos", reason: "School fees for her daughter", outcome: OUTCOMES.Amara },
  { id: 1, name: "Chidi", city: "London", reason: "A first month's rent deposit", outcome: OUTCOMES.Chidi },
  { id: 2, name: "Fatima", city: "Nairobi", reason: "A refrigerator for her shop", outcome: OUTCOMES.Fatima },
];

/** Closing framing — the ecosystem "why this matters". */
export const CLOSING = {
  eyebrow: "Why it matters",
  headline: "A billion people already save this way. Now it's programmable.",
  body: "Rotating savings circles — susu, tanda, committee, chama — move hundreds of billions of dollars a year on trust alone. Sanctuary keeps the trust and the human ritual, and adds what was always missing: bonds that can't quietly vanish, and a ledger anyone can check.",
} as const;
