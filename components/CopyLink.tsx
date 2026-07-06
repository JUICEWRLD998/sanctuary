"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyLinkProps {
  /** App-relative path to share, e.g. "/circle/lagos-abc12". */
  path: string;
  /** Accessible description of what's being copied. */
  label?: string;
}

/**
 * A read-only invite link with a copy button. Resolves the absolute URL on the
 * client (window.location.origin) so the link works when sent to a friend, and
 * shows a brief "Copied" confirmation.
 */
export function CopyLink({ path, label = "invite link" }: CopyLinkProps) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  // Resolve the origin on the client only, to avoid a hydration mismatch.
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = origin ? `${origin}${path}` : path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context) — the field is still
      // selectable so the user can copy manually.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={label}
        className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 font-data text-xs text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Copy ${label}`}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}
