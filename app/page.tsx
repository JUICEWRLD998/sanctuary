import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { BitcoinBadge } from "@/components/BitcoinBadge";
import { Avatar } from "@/components/Avatar";
import { Reveal } from "@/components/Reveal";
import { CLOSING, HOW_IT_WORKS, PEOPLE, STORY } from "@/content/story";

/**
 * The landing — the emotional front door (implementation.md §4, Phase 5). Tells
 * the human story (susu / tanda reimagined), shows the real people of the demo
 * circle and what their pot means, frames the Bitcoin-finality credibility
 * anchor, then routes into the live hero. Warm Vault design system throughout;
 * motion is scroll-reveal only (reduced-motion aware) so content stays readable.
 */
/**
 * Pulsing green "LIVE" dot — marks the in-progress-circle button so it reads as
 * genuinely live and stays visually distinct from the gold "completed" CTA.
 * Decorative only (the label carries the meaning), so it's aria-hidden.
 */
function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-live-pulse" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
    </span>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 text-center">
        <Reveal>
          <BitcoinBadge variant="chip" />
        </Reveal>
        <Reveal index={1}>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">{STORY.eyebrow}</p>
        </Reveal>
        <Reveal index={2}>
          <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight sm:text-5xl">
            {STORY.headline}
          </h1>
        </Reveal>
        <Reveal index={3}>
          <p className="max-w-xl text-balance text-fg-muted">{STORY.subhead}</p>
        </Reveal>
        <Reveal index={4}>
          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/circle/demo"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-gradient-gold px-6 py-3 font-medium text-primary-fg shadow-glow transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Watch a completed circle
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/circle/live"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-success/50 bg-surface px-6 py-3 font-medium text-fg transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <LiveDot />
              See a circle in progress
            </Link>
          </div>
        </Reveal>
      </section>

      {/* How it works */}
      <section className="mt-24 sm:mt-32" aria-labelledby="how-heading">
        <Reveal>
          <h2 id="how-heading" className="text-center text-2xl font-bold sm:text-3xl">
            How a circle works
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <Reveal key={step.step} index={i} as="article">
              <div className="h-full rounded-lg border border-border bg-surface p-6 shadow-card">
                <span className="font-data text-sm text-primary">{step.step}</span>
                <h3 className="mt-3 text-lg font-semibold text-fg">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The people */}
      <section className="mt-24 sm:mt-32" aria-labelledby="people-heading">
        <Reveal>
          <h2 id="people-heading" className="text-center text-2xl font-bold sm:text-3xl">
            Three people, one circle
          </h2>
        </Reveal>
        <Reveal index={1}>
          <p className="mx-auto mt-3 max-w-xl text-balance text-center text-sm text-fg-muted">
            The demo circle runs live on the Stacks testnet. Real wallets, real transactions — and a
            real reason each of them is saving.
          </p>
        </Reveal>
        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {PEOPLE.map((p, i) => (
            <Reveal key={p.id} index={i} as="li">
              <div className="flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-6 shadow-card">
                <div className="flex items-center gap-3">
                  <Avatar id={p.id} name={p.name} size="md" />
                  <div>
                    <p className="font-semibold text-fg">{p.name}</p>
                    <p className="text-xs text-fg-muted">{p.city}</p>
                  </div>
                </div>
                <p className="text-sm font-medium text-fg">{p.reason}</p>
                <p className="mt-auto flex items-start gap-1.5 text-sm text-fg-muted">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span className="text-balance">{p.outcome}</span>
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Bitcoin-finality framing */}
      <section className="mt-24 sm:mt-32" aria-labelledby="proof-heading">
        <Reveal>
          <div className="rounded-lg border border-primary/30 bg-surface bg-vault-glow p-8 text-center shadow-card sm:p-12">
            <ShieldCheck className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
            <h2 id="proof-heading" className="mt-4 text-2xl font-bold sm:text-3xl">
              Not a mock-up. Real money, secured by Bitcoin.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-balance text-fg-muted">{STORY.proof}</p>
          </div>
        </Reveal>
      </section>

      {/* Closing — why it matters */}
      <section className="mt-24 sm:mt-32" aria-labelledby="closing-heading">
        <Reveal>
          <p className="text-center text-xs font-medium uppercase tracking-wide text-primary">
            {CLOSING.eyebrow}
          </p>
        </Reveal>
        <Reveal index={1}>
          <h2 id="closing-heading" className="mx-auto mt-3 max-w-2xl text-balance text-center text-2xl font-bold sm:text-3xl">
            {CLOSING.headline}
          </h2>
        </Reveal>
        <Reveal index={2}>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-center text-fg-muted">{CLOSING.body}</p>
        </Reveal>
        <Reveal index={3}>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/circle/demo"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-gradient-gold px-6 py-3 font-medium text-primary-fg shadow-glow transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Watch a completed circle
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/circle/live"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-success/50 bg-surface px-6 py-3 font-medium text-fg transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <LiveDot />
              See a circle in progress
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="mt-24 border-t border-border pt-8 text-center text-xs text-fg-muted sm:mt-32">
        <p>
          Sanctuary — programmable, Bitcoin-secured savings circles on Stacks. Built on the FlowVault
          SDK (Lock · Split · Hold).
        </p>
      </footer>
    </main>
  );
}
