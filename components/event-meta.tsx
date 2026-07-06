import {
  AlertTriangle,
  ArrowRight,
  Coins,
  Gift,
  Info,
  LifeBuoy,
  Lock,
  Users,
  UserPlus,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { EventKind } from "@/lib/circle-view";

interface KindMeta {
  Icon: LucideIcon;
  label: string;
  /** Text/icon accent class. */
  tone: string;
  /** Badge background + border class. */
  chip: string;
}

/**
 * Per-event-kind presentation: icon, short label, and warm-palette accent.
 * Status is conveyed by icon + label + color together (never color alone).
 */
export const EVENT_META: Record<EventKind, KindMeta> = {
  bond: { Icon: Coins, label: "Bond", tone: "text-accent", chip: "bg-accent/10 border-accent/25" },
  "escrow-lock": {
    Icon: Lock,
    label: "Escrow lock",
    tone: "text-primary",
    chip: "bg-primary/10 border-primary/25",
  },
  contribution: {
    Icon: ArrowRight,
    label: "Contribution",
    tone: "text-fg-muted",
    chip: "bg-surface-2 border-border",
  },
  default: {
    Icon: AlertTriangle,
    label: "Default",
    tone: "text-destructive",
    chip: "bg-destructive/10 border-destructive/30",
  },
  payout: {
    Icon: Gift,
    label: "Payout",
    tone: "text-primary",
    chip: "bg-primary/10 border-primary/25",
  },
  compensation: {
    Icon: LifeBuoy,
    label: "Compensation",
    tone: "text-success",
    chip: "bg-success/10 border-success/25",
  },
  "bond-return": {
    Icon: Undo2,
    label: "Bond return",
    tone: "text-success",
    chip: "bg-success/10 border-success/25",
  },
  "member-join": {
    Icon: UserPlus,
    label: "Member joins",
    tone: "text-accent",
    chip: "bg-accent/10 border-accent/25",
  },
  "circle-form": {
    Icon: Users,
    label: "Circle forms",
    tone: "text-primary",
    chip: "bg-primary/10 border-primary/25",
  },
  note: { Icon: Info, label: "Note", tone: "text-fg-muted", chip: "bg-surface-2 border-border" },
};
