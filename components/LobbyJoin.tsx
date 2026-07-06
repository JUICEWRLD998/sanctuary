"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, LogOut, Wallet } from "lucide-react";
import { txUrl, waitForTx } from "@/lib/explorer";
import {
  connectWallet,
  connectedStxAddress,
  depositJoin,
  disconnectWallet,
  fetchUsdcxBalance,
  setJoinStrategy,
  upfrontTotal,
  walletVault,
} from "@/lib/wallet";
import { ExplorerLink, shortTxid } from "./ExplorerLink";

interface LobbyJoinProps {
  circleId: string;
  escrowAddress: string | null;
  capacity: number;
  contribution: string;
  bond: string;
  /** Addresses already in the circle — to block a double-join from this wallet. */
  joinedAddresses: string[];
  /** Called after a successful join so the page can refetch the lobby. */
  onJoined: () => void;
}

type Step =
  | "idle"
  | "signing-rule"
  | "confirming-rule"
  | "signing-deposit"
  | "confirming-deposit"
  | "recording"
  | "done";

const BUSY: Step[] = [
  "signing-rule",
  "confirming-rule",
  "signing-deposit",
  "confirming-deposit",
  "recording",
];

function short(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 5)}…${addr.slice(-4)}` : addr;
}

/** testnet is ST…/SN…, mainnet SP…/SM…; the circle + its USDCx live on testnet. */
function isTestnetAddress(addr: string): boolean {
  return addr.startsWith("ST") || addr.startsWith("SN");
}

/**
 * Real-user join: a person connects their own wallet, says who they are and what
 * they're saving for, and funds their FULL upfront obligation
 * (bond + (N-1)×contribution) into the escrow — then the server records them as a
 * real member. No private key ever leaves the wallet.
 */
export function LobbyJoin({
  circleId,
  escrowAddress,
  capacity,
  contribution,
  bond,
  joinedAddresses,
  onJoined,
}: LobbyJoinProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [ruleTx, setRuleTx] = useState<string | null>(null);
  const [depositTx, setDepositTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = upfrontTotal(capacity, contribution, bond);

  const refreshBalance = useCallback(async (addr: string) => {
    try {
      setBalance(await fetchUsdcxBalance(addr));
    } catch {
      setBalance(null);
    }
  }, []);

  useEffect(() => {
    const addr = connectedStxAddress();
    if (addr) {
      setAddress(addr);
      refreshBalance(addr);
    }
  }, [refreshBalance]);

  async function onConnect() {
    setError(null);
    try {
      const addr = await connectWallet();
      setAddress(addr);
      await refreshBalance(addr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect the wallet.");
    }
  }

  function onDisconnect() {
    disconnectWallet();
    setAddress(null);
    setBalance(null);
    setStep("idle");
    setRuleTx(null);
    setDepositTx(null);
    setError(null);
  }

  async function onJoin() {
    if (!address || !escrowAddress || !isTestnetAddress(address)) return;
    setError(null);
    setRuleTx(null);
    setDepositTx(null);
    const vault = walletVault(address);
    try {
      // 1) Sign the routing rule: split the full upfront amount to the escrow.
      setStep("signing-rule");
      const rule = await setJoinStrategy(vault, escrowAddress, total);
      setRuleTx(rule);

      setStep("confirming-rule");
      const ruleStatus = await waitForTx(rule);
      if (ruleStatus !== "success") {
        throw new Error(`The routing-rule transaction did not confirm (status: ${ruleStatus}).`);
      }

      // 2) Deposit the full upfront amount — it routes into the escrow.
      setStep("signing-deposit");
      const dep = await depositJoin(vault, total);
      setDepositTx(dep);

      setStep("confirming-deposit");
      const depStatus = await waitForTx(dep);
      if (depStatus !== "success") {
        throw new Error(`The deposit transaction did not confirm (status: ${depStatus}).`);
      }

      // 3) Record membership server-side (verifies the deposit + may auto-form).
      setStep("recording");
      const res = await fetch("/api/open/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: circleId, address, name, purpose, fundTxid: dep }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not record your membership.");

      setStep("done");
      await refreshBalance(address);
      onJoined();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The join failed.");
      setStep("idle");
    }
  }

  const busy = BUSY.includes(step);
  const wrongNetwork = address != null && !isTestnetAddress(address);
  const alreadyJoined = address != null && joinedAddresses.includes(address);
  const insufficient = !wrongNetwork && balance != null && balance < Number(total);
  const detailsMissing = !name.trim() || !purpose.trim();

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="font-display text-sm font-semibold text-fg">Join this circle</h2>
      </div>
      <p className="mt-2 text-xs text-fg-muted text-balance">
        Connect your wallet, tell the circle who you are and what you&apos;re saving for, and fund
        your {total} USDCx upfront ({bond} bond + {Number(total) - Number(bond)} in contributions).
        You&apos;ll receive the whole pot on your turn.
      </p>

      {!address ? (
        <button
          type="button"
          onClick={onConnect}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Wallet className="h-4 w-4" aria-hidden="true" />
          Connect wallet
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-2">
            <div className="min-w-0">
              <p className="font-data text-xs text-fg">{short(address)}</p>
              <p className="text-[11px] text-fg-muted">
                {wrongNetwork
                  ? "on mainnet — switch to testnet"
                  : balance == null
                    ? "balance —"
                    : `${balance} USDCx available`}
              </p>
            </div>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-fg-muted transition-colors hover:text-fg disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Disconnect wallet"
            >
              <LogOut className="h-3 w-3" aria-hidden="true" />
              Disconnect
            </button>
          </div>

          {alreadyJoined ? (
            <p className="flex items-center gap-1.5 text-xs text-success" role="status">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              This wallet has already joined the circle.
            </p>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs text-fg-muted">
                Your name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy || step === "done"}
                  maxLength={40}
                  placeholder="e.g. Amara"
                  className="min-h-[40px] rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-fg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fg-muted">
                What you&apos;re saving for
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  disabled={busy || step === "done"}
                  maxLength={80}
                  placeholder="e.g. School fees for my daughter"
                  className="min-h-[40px] rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-fg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              {wrongNetwork ? (
                <p className="flex items-start gap-1.5 text-xs text-fg-muted">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
                  This wallet is on <span className="font-medium text-fg">mainnet</span>. Switch to
                  Testnet and reconnect — your address will start with{" "}
                  <span className="font-data">ST…</span>.
                </p>
              ) : (
                insufficient &&
                step !== "done" && (
                  <p className="flex items-start gap-1.5 text-xs text-fg-muted">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
                    You need at least {total} USDCx on testnet to join. Fund this wallet via the
                    FlowVault dApp faucet first.
                  </p>
                )
              )}

              <button
                type="button"
                onClick={onJoin}
                disabled={busy || wrongNetwork || insufficient || detailsMissing || !escrowAddress}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-primary-fg shadow-glow transition-transform duration-200 hover:enabled:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                aria-live="polite"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {step === "signing-rule" && "Sign the routing rule…"}
                {step === "confirming-rule" && "Confirming routing rule…"}
                {step === "signing-deposit" && "Sign the deposit…"}
                {step === "confirming-deposit" && "Confirming deposit…"}
                {step === "recording" && "Recording your seat…"}
                {(step === "idle" || step === "done") && `Join — fund ${total} USDCx`}
              </button>

              {(ruleTx || depositTx) && (
                <ol className="flex flex-col gap-1.5 text-xs">
                  <StepRow
                    label="Routing rule set (split → escrow)"
                    tx={ruleTx}
                    done={Boolean(ruleTx) && step !== "signing-rule"}
                  />
                  <StepRow
                    label="Upfront funds deposited into escrow"
                    tx={depositTx}
                    done={step === "recording" || step === "done"}
                  />
                </ol>
              )}
            </>
          )}

          {step === "done" && (
            <p className="flex items-center gap-1.5 text-xs text-success" role="status">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              You&apos;re in — your seat is funded and live on testnet.
            </p>
          )}

          {error && (
            <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StepRow({ label, tx, done }: { label: string; tx: string | null; done: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-fg-muted">
        {done ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
        ) : tx ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-fg-muted" aria-hidden="true" />
        ) : (
          <span className="h-3.5 w-3.5 rounded-full border border-border" aria-hidden="true" />
        )}
        {label}
      </span>
      {tx && (
        <ExplorerLink url={txUrl(tx)} label={label}>
          {shortTxid(tx)}
        </ExplorerLink>
      )}
    </li>
  );
}
