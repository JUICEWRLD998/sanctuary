import type { EventView } from "@/lib/circle-view";
import { EVENT_META } from "./event-meta";
import { ExplorerLink, shortTxid } from "./ExplorerLink";

interface RoundTimelineProps {
  events: EventView[];
}

/**
 * Vertical ledger of every step in the circle's life, in order. Each on-chain
 * event links out to the Hiro explorer — this is the audit trail the bounty
 * requires ("auditable via explorer links").
 */
export function RoundTimeline({ events }: RoundTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-fg-muted">
        No activity yet. Run the circle to see live transactions appear here.
      </p>
    );
  }

  return (
    <ol className="relative flex flex-col gap-1" aria-label="Circle activity ledger">
      {events.map((event, i) => {
        const meta = EVENT_META[event.kind];
        const { Icon } = meta;
        const isLast = i === events.length - 1;
        return (
          <li key={i} className="relative flex gap-3 pb-1">
            {/* Rail + node */}
            <div className="flex flex-col items-center">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${meta.chip}`}
              >
                <Icon className={`h-4 w-4 ${meta.tone}`} aria-hidden="true" />
              </span>
              {!isLast && <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />}
            </div>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col gap-1 pb-3 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 text-sm text-fg">
                  <span className={`mr-2 text-xs font-medium uppercase tracking-wide ${meta.tone}`}>
                    {meta.label}
                  </span>
                  {event.label}
                </p>
                {event.amount && (
                  <span className="font-data text-sm text-fg">{event.amount} USDCx</span>
                )}
              </div>
              {event.url && event.txid && (
                <ExplorerLink url={event.url} label={`${meta.label} transaction`}>
                  {shortTxid(event.txid)}
                </ExplorerLink>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
