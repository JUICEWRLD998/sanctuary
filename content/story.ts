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
