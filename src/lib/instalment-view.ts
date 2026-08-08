// ============================================================
// Aufbereitung des Ratenplans für Portal und Admin.
// Reine Funktionen – keine DB, kein React.
// ============================================================

import { roundRappen, todayInZurich } from "@/lib/subscription";

export type InstalmentRow = {
  id: string;
  sequence: number;
  kind: string;
  amount: number | string;
  /** ISO-Tag YYYY-MM-DD */
  due_date: string;
  status: string;
  invoice_id: string | null;
  paid_at?: string | null;
};

/** Zustand einer Rate aus Sicht der Oberfläche. */
export type InstalmentUiState =
  | "bezahlt"
  | "in_pruefung"
  | "ueberfaellig"
  | "offen"
  | "geplant"
  | "storniert";

export type InstalmentView = {
  id: string;
  sequence: number;
  /** "Anzahlung" bzw. "Rate 2 von 4" */
  label: string;
  shortLabel: string;
  amount: number;
  dueDate: string;
  state: InstalmentUiState;
  invoiceId: string | null;
  /** Tage bis zur Fälligkeit; negativ = überfällig. */
  daysUntilDue: number;
  /** Die nächste zu zahlende Rate – genau eine im Plan. */
  isNext: boolean;
};

export type PlanSummary = {
  entries: InstalmentView[];
  total: number;
  paidAmount: number;
  openAmount: number;
  paidCount: number;
  totalCount: number;
  /** 0–100, gerundet. */
  percentPaid: number;
  next: InstalmentView | null;
  overdueCount: number;
  overdueAmount: number;
  /** true, sobald mindestens eine Rate überfällig ist. */
  hasOverdue: boolean;
};

/** Tage zwischen zwei ISO-Tagen (b − a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000
  );
}

function uiState(row: InstalmentRow, today: string): InstalmentUiState {
  switch (row.status) {
    case "paid":
      return "bezahlt";
    case "pending_confirmation":
      return "in_pruefung";
    case "cancelled":
      return "storniert";
    case "overdue":
      return "ueberfaellig";
    case "invoiced":
      return daysBetween(row.due_date, today) > 0 ? "ueberfaellig" : "offen";
    default:
      // "open": noch nicht fakturiert.
      return daysBetween(row.due_date, today) >= 0 ? "offen" : "geplant";
  }
}

export function instalmentLabels(
  row: { kind: string; sequence: number },
  instalmentCount: number
): { label: string; shortLabel: string } {
  if (row.kind === "anzahlung") {
    return { label: "Anzahlung", shortLabel: "Anzahlung" };
  }
  return {
    label: `Rate ${row.sequence} von ${instalmentCount}`,
    shortLabel: `Rate ${row.sequence}/${instalmentCount}`,
  };
}

/**
 * Baut die Anzeige-Sicht auf einen Ratenplan.
 *
 * `today` ist injizierbar, damit Server und Tests denselben Stichtag
 * verwenden können; ohne Angabe gilt das Datum in Europe/Zurich.
 */
export function buildPlanSummary(
  rows: InstalmentRow[],
  today: string = todayInZurich()
): PlanSummary {
  const sorted = [...rows].sort((a, b) => a.sequence - b.sequence);
  const instalmentCount = sorted.filter((r) => r.kind !== "anzahlung").length;

  const entries: InstalmentView[] = sorted.map((row) => {
    const { label, shortLabel } = instalmentLabels(row, instalmentCount);
    return {
      id: row.id,
      sequence: row.sequence,
      label,
      shortLabel,
      amount: roundRappen(Number(row.amount)),
      dueDate: row.due_date,
      state: uiState(row, today),
      invoiceId: row.invoice_id,
      daysUntilDue: daysBetween(today, row.due_date),
      isNext: false,
    };
  });

  // Nächste offene Rate markieren: die früheste, die noch nicht bezahlt
  // oder storniert ist.
  const nextIndex = entries.findIndex(
    (e) => e.state !== "bezahlt" && e.state !== "storniert"
  );
  if (nextIndex >= 0) entries[nextIndex].isNext = true;

  const relevant = entries.filter((e) => e.state !== "storniert");
  const total = roundRappen(relevant.reduce((s, e) => s + e.amount, 0));
  const paid = relevant.filter((e) => e.state === "bezahlt");
  const paidAmount = roundRappen(paid.reduce((s, e) => s + e.amount, 0));
  const overdue = relevant.filter((e) => e.state === "ueberfaellig");

  return {
    entries,
    total,
    paidAmount,
    openAmount: roundRappen(total - paidAmount),
    paidCount: paid.length,
    totalCount: relevant.length,
    percentPaid: total > 0 ? Math.round((paidAmount / total) * 100) : 0,
    next: nextIndex >= 0 ? entries[nextIndex] : null,
    overdueCount: overdue.length,
    overdueAmount: roundRappen(overdue.reduce((s, e) => s + e.amount, 0)),
    hasOverdue: overdue.length > 0,
  };
}

/** "in 9 Tagen", "heute", "seit 3 Tagen überfällig". */
export function dueLabel(daysUntilDue: number, overdue: boolean): string {
  if (overdue) {
    const d = Math.abs(daysUntilDue);
    if (d === 0) return "heute fällig";
    return `${d} ${d === 1 ? "Tag" : "Tage"} überfällig`;
  }
  if (daysUntilDue === 0) return "heute fällig";
  if (daysUntilDue === 1) return "morgen fällig";
  if (daysUntilDue < 0) return "fällig";
  return `fällig in ${daysUntilDue} Tagen`;
}

/** Kurzes Datum "7. Okt. 2026". */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const monate = [
    "Jan.", "Feb.", "März", "Apr.", "Mai", "Juni",
    "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez.",
  ];
  return `${d}. ${monate[m - 1]} ${y}`;
}
