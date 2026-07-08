"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Bot } from "lucide-react";
import { AiChat } from "./AiChat";

/** Routing destinations shared by the desktop bar and the mobile dropdown. */
const LINKS = [
  { href: "/browse", label: "Browse" },
  { href: "/my-circles", label: "My Circles" },
  { href: "/circle/demo", label: "Demo" },
];

/** A single desktop top-nav link. */
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </Link>
  );
}

/**
 * Global top navigation (rendered from the root layout, so it's on every page).
 * Desktop shows the links inline; mobile collapses them into a hamburger
 * dropdown. The "Secured by Bitcoin" chip is desktop-only, so it never crowds
 * the mobile bar or appears in the dropdown.
 */
export function Navbar() {
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <nav className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            onClick={close}
            className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Sanctuary home"
          >
            <span className="font-display text-base font-bold tracking-tight text-fg">Sanctuary</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-0.5 sm:flex">
            {LINKS.map((l) => (
              <NavLink key={l.href} href={l.href}>
                {l.label}
              </NavLink>
            ))}

            {/* AI Button */}
            <button
              id="nav-ai-button"
              type="button"
              onClick={() => setAiOpen(true)}
              className="ml-1 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                background: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.1))",
                border: "1px solid rgba(245,158,11,0.3)",
                color: "var(--color-primary)",
              }}
              aria-label="Open Sanctuary AI assistant"
              title="Ask questions about savings circles and Bitcoin"
            >
              <span>AI</span>
            </button>

            <Link
              href="/create"
              className="ml-1 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Create
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-md border border-border text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {/* Mobile dropdown — links only, no Bitcoin chip. */}
        {open && (
          <div className="border-t border-border bg-bg sm:hidden">
            <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-3">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={close}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {l.label}
                </Link>
              ))}

              {/* AI — mobile */}
              <button
                type="button"
                onClick={() => {
                  close();
                  setAiOpen(true);
                }}
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ color: "var(--color-primary)" }}
              >
                <Bot className="h-4 w-4" />
                Ask Sanctuary AI
              </button>

              <Link
                href="/create"
                onClick={close}
                className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Create
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* AI Chat Panel — rendered outside nav so it can overlay the full page */}
      <AiChat open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}
