"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  Wallet,
} from "lucide-react";
import { txUrl, waitForTx } from "@/lib/explorer";
import {
  connectWallet,
  connectedStxAddress,
  depositJoin,
  disconnectWallet,
  fetchUsdcxBalance,
  setJoinStrategy,
  walletVault,
} from "@/lib/wallet";
import { ExplorerLink, shortTxid } from "./ExplorerLink";

interface ConnectJoinProps {
  escrowAddress: string | null;
  escrowName: string;
  /** Bond amount to route into escrow, whole USDCx. */
  bond: string;
}

type Step =
  | "idle"
  | "signing-rule"
  | "confirming-rule"
  | "signing-deposit"
  | "confirming-deposit"
  | "done";

const BUSY: Step[] = ["signing-rule", "confirming-rule", "signing-deposit", "confirming-deposit"];

function short(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 5)}…${addr.slice(-4)}` : addr;
}

/**
 * Stacks encodes the network in the address prefix: testnet is `ST…`/`SN…`,
 * mainnet is `SP…`/`SM…`. The demo (and its USDCx) live on testnet, so a wallet
 * left on mainnet must switch before it can join — otherwise the testnet balance
 * read finds nothing and the signature would target the wrong network.
 */
function isTestnetAddress(addr: string): boolean {
  return addr.startsWith("ST") || addr.startsWith("SN");
}

/**
 * Wallet-mode join: a judge connects their own wallet and posts a real bond into
 * the Sanctuary escrow — set routing rule (split → escrow), then deposit, both
 * signed in their wallet. Two signatures, with a confirmation wait between them
 * because FlowVault applies a principal's rule on its *next* deposit.
 */
export function ConnectJoin({ escrowAddress, escrowName, bond }: ConnectJoinProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [ruleTx, setRuleTx] = useState<string | null>(null);
  const [depositTx, setDepositTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async (addr: string) => {
    try {
      setBalance(await fetchUsdcxBalance(addr));
    } catch {
      setBalance(null);
    }
  }, []);

  // Restore an existing session on mount.
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
      // 1) Sign the routing rule: split the bond to the escrow on next deposit.
      setStep("signing-rule");
      const rule = await setJoinStrategy(vault, escrowAddress, bond);
      setRuleTx(rule);

      // 2) Wait for it to confirm — the deposit consumes the stored rule.
      setStep("confirming-rule");
      const ruleStatus = await waitForTx(rule);
      if (ruleStatus !== "success") {
        throw new Error(`The routing-rule transaction did not confirm (status: ${ruleStatus}).`);
      }

      // 3) Sign the deposit — the bond routes into escrow atomically.
      setStep("signing-deposit");
      const dep = await depositJoin(vault, bond);
      setDepositTx(dep);

      // 4) Wait for the deposit to settle.
      setStep("confirming-deposit");
      const depStatus = await waitForTx(dep);
      if (depStatus !== "success") {
        throw new Error(`The deposit transaction did not confirm (status: ${depStatus}).`);
      }

      setStep("done");
      await refreshBalance(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The join failed.");
      setStep("idle");
    }
  }

  const busy = BUSY.includes(step);
  const wrongNetwork = address != null && !isTestnetAddress(address);
  const insufficient = !wrongNetwork && balance != null && balance < Number(bond);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="font-display text-sm font-semibold text-fg">Join with your own wallet</h2>
      </div>
      <p className="mt-2 text-xs text-fg-muted text-balance">
        Post a real {bond} USDCx bond into {escrowName} from your wallet — the exact split-then-deposit
        move a circle member makes, signed by you on Stacks testnet.
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

          {wrongNetwork ? (
            <p className="flex items-start gap-1.5 text-xs text-fg-muted">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
              This wallet is on <span className="font-medium text-fg">mainnet</span> ({short(address)}).
              Sanctuary runs on Stacks testnet — switch your wallet to Testnet, then reconnect. Your
              address will start with <span className="font-data">ST…</span>; fund that one with USDCx.
            </p>
          ) : (
            insufficient &&
            step !== "done" && (
              <p className="flex items-start gap-1.5 text-xs text-fg-muted">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
                You need at least {bond} USDCx on testnet to join. USDCx is protocol-mint-gated — fund
                this wallet via the FlowVault dApp faucet first.
              </p>
            )
          )}

          <button
            type="button"
            onClick={onJoin}
            disabled={busy || wrongNetwork || insufficient || !escrowAddress}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-gradient-gold px-4 py-2 text-sm font-medium text-primary-fg shadow-glow transition-transform duration-200 hover:enabled:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            aria-live="polite"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {step === "signing-rule" && "Sign the routing rule…"}
            {step === "confirming-rule" && "Confirming routing rule…"}
            {step === "signing-deposit" && "Sign the deposit…"}
            {step === "confirming-deposit" && "Confirming deposit…"}
            {(step === "idle" || step === "done") && `Join — bond ${bond} USDCx`}
          </button>

          {/* Progress: the two signed transactions with explorer links. */}
          {(ruleTx || depositTx || step === "done") && (
            <ol className="flex flex-col gap-1.5 text-xs">
              <StepRow
                label="Routing rule set (split → escrow)"
                tx={ruleTx}
                done={Boolean(ruleTx) && step !== "signing-rule"}
              />
              <StepRow
                label="Bond deposited into escrow"
                tx={depositTx}
                done={step === "done"}
              />
            </ol>
          )}

          {step === "done" && (
            <p className="flex items-center gap-1.5 text-xs text-success" role="status">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Joined — your bond is live in the escrow on testnet.
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
