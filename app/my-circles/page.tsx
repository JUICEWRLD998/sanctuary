"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { connectWallet, connectedStxAddress } from "@/lib/wallet";
import { Loader2, Circle, CheckCircle2, Clock } from "lucide-react";
import { Reveal } from "@/components/Reveal";

interface MyCircle {
  id: string;
  title: string;
  capacity: number;
  myPosition: number;
  contribution: string;
  phase: string;
  currentRound: number;
  totalRounds: number;
  nextPayoutDate?: string;
}

export default function MyCirclesPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [circles, setCircles] = useState<MyCircle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCircles, setLoadingCircles] = useState(false);

  useEffect(() => {
    // Check if wallet is already connected
    const addr = connectedStxAddress();
    if (addr) {
      setAddress(addr);
      loadUserCircles(addr);
    } else {
      setLoading(false);
    }
  }, []);

  const loadUserCircles = async (addr: string) => {
    setLoadingCircles(true);
    try {
      const res = await fetch(`/api/user/circles?address=${addr}`);
      if (res.ok) {
        const data = await res.json();
        setCircles(data.circles || []);
      }
    } catch (err) {
      console.error("Failed to load circles:", err);
    } finally {
      setLoadingCircles(false);
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      const addr = await connectWallet();
      setAddress(addr);
      await loadUserCircles(addr);
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      setLoading(false);
    }
  };

  if (!address && !loading) {
    return (
      <main id="main-content" className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">My Circles</h1>
          <p className="mt-4 text-fg-muted">Connect your wallet to see your circles</p>
          <button
            onClick={handleConnect}
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-gradient-gold px-6 py-3 font-medium text-primary-fg transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Connect Wallet
          </button>
        </div>
      </main>
    );
  }

  if (loading || loadingCircles) {
    return (
      <main id="main-content" className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
      <Reveal index={0}>
        <h1 className="text-4xl font-bold tracking-tight">My Circles</h1>
        <p className="mt-2 text-fg-muted">
          Track all your savings circles in one place
        </p>
        {address && (
          <p className="mt-2 font-data text-xs text-fg-muted">
            Connected: {address.slice(0, 8)}...{address.slice(-6)}
          </p>
        )}
      </Reveal>

      {circles.length === 0 && (
        <div className="mt-12 rounded-lg border border-border bg-surface p-12 text-center">
          <Circle className="mx-auto h-12 w-12 text-fg-muted" />
          <h2 className="mt-4 text-xl font-semibold text-fg">No circles yet</h2>
          <p className="mt-2 text-fg-muted">
            Join an existing circle or create your own to get started
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Browse Circles
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

      {circles.length > 0 && (
        <div className="mt-8 space-y-4">
          {circles.map((circle, idx) => (
            <Reveal key={circle.id} index={idx + 1}>
              <Link
                href={`/circle/${circle.id}`}
                className="group block rounded-lg border border-border bg-surface p-6 transition-all hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-fg group-hover:text-primary transition-colors">
                      {circle.title}
                    </h3>
                    <p className="mt-1 text-sm text-fg-muted">
                      Position {circle.myPosition} of {circle.capacity} • {circle.contribution} USDCx per round
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      circle.phase === "active"
                        ? "bg-green-500/10 text-green-500"
                        : circle.phase === "complete"
                          ? "bg-fg-muted/10 text-fg-muted"
                          : "bg-primary/10 text-primary"
                    }`}
                  >
                    {circle.phase}
                  </span>
                </div>

                {circle.phase === "active" && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-fg-muted" />
                      <span className="text-fg-muted">
                        Round {circle.currentRound + 1} of {circle.totalRounds}
                      </span>
                    </div>
                    {circle.nextPayoutDate && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-green-500 font-medium">
                          Your turn: {new Date(circle.nextPayoutDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Progress indicator */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-fg-muted">
                    <span>Progress</span>
                    <span>{Math.round((circle.currentRound / circle.totalRounds) * 100)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full bg-gradient-gold transition-all"
                      style={{ width: `${(circle.currentRound / circle.totalRounds) * 100}%` }}
                    />
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </main>
  );
}
