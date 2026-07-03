import { ExternalLink } from "lucide-react";

interface ExplorerLinkProps {
  url: string;
  /** Short txid/label text to display (e.g. "0x81ad…d985"). */
  children: React.ReactNode;
  /** Accessible description, e.g. "compensation transaction". */
  label?: string;
  className?: string;
}

/** Consistent, accessible link out to the Hiro explorer for a tx or address. */
export function ExplorerLink({ url, children, label, className = "" }: ExplorerLinkProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label ? `${label} on the Hiro explorer (opens in a new tab)` : undefined}
      className={`inline-flex items-center gap-1 rounded font-data text-xs text-fg-muted underline decoration-border underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  );
}

/** Truncate a txid for compact display: 0x81ad0f…c7d985. */
export function shortTxid(txid: string): string {
  const t = txid.startsWith("0x") ? txid : `0x${txid}`;
  return t.length > 14 ? `${t.slice(0, 6)}…${t.slice(-6)}` : t;
}
