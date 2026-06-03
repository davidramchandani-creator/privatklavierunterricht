import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Zentrale Status-Anzeige (Design-System, Spec §1 + §6/§4/§5).
 *
 * Kapselt das komplette Mapping Status → deutsches Label → Farbe an EINER
 * Stelle, statt es über Portal/Admin verteilt zu duplizieren. Farbsprache:
 *   success (emerald) = bezahlt/aktiv/stattgefunden
 *   pending (amber)   = in Prüfung/ausstehend/pausiert
 *   danger  (red)     = offen/abgelehnt/abgelaufen/nicht erschienen
 *   info    (navy)    = gebucht/angenommen
 *   neutral (slate)   = storniert/archiviert/zurückgezogen
 */
type Tone = "success" | "pending" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  info: "bg-navy-50 text-navy-900 ring-navy-900/15",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

type Entry = { label: string; tone: Tone };

const PAYMENT: Record<string, Entry> = {
  unpaid: { label: "Offen", tone: "danger" },
  pending_confirmation: { label: "In Prüfung", tone: "pending" },
  paid: { label: "Bezahlt", tone: "success" },
  rejected: { label: "Abgelehnt", tone: "danger" },
  archived: { label: "Archiviert", tone: "neutral" },
  cancelled: { label: "Storniert", tone: "neutral" },
};

const APPOINTMENT: Record<string, Entry> = {
  booked: { label: "Gebucht", tone: "info" },
  pending: { label: "Ausstehend", tone: "pending" },
  completed: { label: "Stattgefunden", tone: "success" },
  cancelled: { label: "Storniert", tone: "neutral" },
  no_show: { label: "Nicht erschienen", tone: "danger" },
};

const PACKAGE: Record<string, Entry> = {
  active: { label: "Aktiv", tone: "success" },
  paused: { label: "Pausiert", tone: "pending" },
  exhausted: { label: "Aufgebraucht", tone: "neutral" },
  expired: { label: "Abgelaufen", tone: "danger" },
  cancelled: { label: "Storniert", tone: "neutral" },
};

const REQUEST: Record<string, Entry> = {
  open: { label: "Offen", tone: "pending" },
  accepted: { label: "Angenommen", tone: "success" },
  rejected: { label: "Abgelehnt", tone: "danger" },
  withdrawn: { label: "Zurückgezogen", tone: "neutral" },
};

/**
 * Berechneter UI-Zustand des aktiven Pakets (lib/packages EffectiveStatus),
 * deutschsprachig – im Gegensatz zum DB-Status `package`.
 */
const PACKAGE_STATE: Record<string, Entry> = {
  kein_paket: { label: "Kein Paket", tone: "pending" },
  aktiv: { label: "Aktiv", tone: "success" },
  pausiert: { label: "Pausiert", tone: "pending" },
  aufgebraucht: { label: "Aufgebraucht", tone: "neutral" },
  abgelaufen: { label: "Abgelaufen", tone: "danger" },
  storniert: { label: "Storniert", tone: "neutral" },
};

const MAPS = {
  payment: PAYMENT,
  appointment: APPOINTMENT,
  package: PACKAGE,
  packageState: PACKAGE_STATE,
  request: REQUEST,
} as const;

export type StatusKind = keyof typeof MAPS;

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  kind: StatusKind;
  status: string;
  /** Optionales Icon links vom Label (z. B. lucide-Icon). */
  icon?: React.ReactNode;
  /** Fällt auf den rohen Status-String zurück, falls unbekannt. */
  fallbackLabel?: string;
}

export function StatusBadge({
  kind,
  status,
  icon,
  fallbackLabel,
  className,
  ...props
}: StatusBadgeProps) {
  const entry: Entry =
    MAPS[kind][status] ?? {
      label: fallbackLabel ?? status,
      tone: "neutral",
    };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-600 ring-1 ring-inset",
        TONE_CLASSES[entry.tone],
        className
      )}
      {...props}
    >
      {icon}
      {entry.label}
    </span>
  );
}
