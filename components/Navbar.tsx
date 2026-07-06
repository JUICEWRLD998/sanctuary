"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { BitcoinBadge } from "./BitcoinBadge";

/** Routing destinations shared by the desktop bar and the mobile dropdown. */
const LINKS = [{ href: "/circle/demo", label: "Demo" }];

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
  const close = () => setOpen(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          onClick={close}
          className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Sanctuary home"
        >
          <span className="font-display text-base font-bold tracking-tight text-fg">Sanctuary</span>
          <BitcoinBadge variant="chip" className="hidden sm:inline-flex" />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-0.5 sm:flex">
          {LINKS.map((l) => (
            <NavLink key={l.href} href={l.href}>
              {l.label}
            </NavLink>
          ))}
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
  );
}
