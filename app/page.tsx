import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BitcoinBadge } from "@/components/BitcoinBadge";
import { STORY } from "@/content/story";

/**
 * Minimal on-brand entry. The full landing (human story, outcome reveal) is
 * Phase 5; for now this routes into the live demo circle — the Phase 3 hero.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <BitcoinBadge variant="chip" />
      <p className="text-xs font-medium uppercase tracking-wide text-primary">{STORY.eyebrow}</p>
      <h1 className="text-balance text-3xl font-bold leading-tight sm:text-5xl">{STORY.headline}</h1>
      <p className="max-w-xl text-balance text-fg-muted">{STORY.subhead}</p>
      <Link
        href="/circle/demo"
        className="mt-2 inline-flex items-center gap-2 rounded-md bg-gradient-gold px-6 py-3 font-medium text-primary-fg shadow-glow transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Watch the circle live
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </main>
  );
}
