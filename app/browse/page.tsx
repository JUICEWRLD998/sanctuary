"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Clock, DollarSign, Loader2 } from "lucide-react";
import { Reveal } from "@/components/Reveal";

interface CirclePreview {
  id: string;
  title: string;
  capacity: number;
  filled: number;
  contribution: string;
  status: "lobby" | "active" | "completed";
  createdAt: string;
}

export default function BrowsePage() {
  const [circles, setCircles] = useState<CirclePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "lobby" | "active">("all");

  useEffect(() => {
    async function loadCircles() {
      try {
        const res = await fetch("/api/circles/list");
        if (res.ok) {
          const data = await res.json();
          setCircles(data.circles || []);
        }
      } catch (err) {
        console.error("Failed to load circles:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCircles();
  }, []);

  const filteredCircles = circles.filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <Reveal index={0}>
        <h1 className="text-center text-4xl font-bold tracking-tight sm:text-5xl">
          Discover Circles
        </h1>
      </Reveal>

      <Reveal index={1}>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-center text-fg-muted">
          Explore all savings circles on Sanctuary. Each circle runs on Bitcoin-secured
          smart contracts with transparent on-chain proof.
        </p>
      </Reveal>

      {/* Filter Tabs */}
      <Reveal index={2}>
        <div className="mt-8 flex justify-center gap-2">
          {[
            { key: "all", label: "All Circles" },
            { key: "lobby", label: "Open to Join" },
            { key: "active", label: "Active" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as typeof filter)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                filter === tab.key
                  ? "bg-primary/20 text-primary"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Reveal>

      {/* Loading State */}
      {loading && (
        <div className="mt-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Circle Grid */}
      {!loading && filteredCircles.length > 0 && (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCircles.map((circle, idx) => (
            <Reveal key={circle.id} index={idx + 3}>
              <Link
                href={`/circle/${circle.id}`}
                className="group block rounded-lg border border-border bg-surface p-6 transition-all hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      circle.status === "lobby"
                        ? "bg-primary/10 text-primary"
                        : circle.status === "active"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-fg-muted/10 text-fg-muted"
                    }`}
                  >
                    {circle.status === "lobby" && "Open"}
                    {circle.status === "active" && "Active"}
                    {circle.status === "completed" && "Completed"}
                  </span>
                </div>

                {/* Title */}
                <h3 className="mt-4 text-lg font-semibold text-fg group-hover:text-primary transition-colors">
                  {circle.title}
                </h3>

                {/* Stats */}
                <div className="mt-4 space-y-2 text-sm text-fg-muted">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>
                      {circle.filled} / {circle.capacity} members
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span>{circle.contribution} USDCx per round</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Created {new Date(circle.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                {circle.status === "lobby" && (
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full bg-gradient-gold transition-all"
                        style={{ width: `${(circle.filled / circle.capacity) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-fg-muted">
                      {circle.capacity - circle.filled} seats remaining
                    </p>
                  </div>
                )}
              </Link>
            </Reveal>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredCircles.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-fg-muted">
            {filter === "all" 
              ? "No circles found. Check out the demo or create the first one!"
              : `No ${filter} circles at the moment.`}
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              href="/circle/demo"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View Demo
            </Link>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-primary-fg transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Create Circle
            </Link>
          </div>
        </div>
      )}

      {/* CTA */}
      {!loading && circles.length > 0 && (
        <Reveal index={filteredCircles.length + 4}>
          <div className="mt-16 rounded-lg border border-primary/30 bg-primary/5 p-8 text-center">
            <h2 className="text-2xl font-semibold text-fg">Ready to start your own?</h2>
            <p className="mt-2 text-fg-muted">
              Create a custom circle with your preferred terms
            </p>
            <Link
              href="/create"
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-6 py-3 font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Create New Circle
            </Link>
          </div>
        </Reveal>
      )}
    </main>
  );
}
