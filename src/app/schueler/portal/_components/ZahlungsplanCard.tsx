"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  CalendarClock,
  RefreshCw,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { formatCHF } from "@/lib/utils";
import {
  dueLabel,
  formatDay,
  type InstalmentUiState,
  type PlanSummary,
} from "@/lib/instalment-view";
import { setAutoRenew } from "../actions";

const STATE_ICON: Record<InstalmentUiState, React.ReactNode> = {
  bezahlt: <CheckCircle2 className="w-[17px] h-[17px] text-emerald-600" />,
  in_pruefung: <Clock className="w-[17px] h-[17px] text-amber-500" />,
  ueberfaellig: <AlertCircle className="w-[17px] h-[17px] text-red-600" />,
  offen: <Clock className="w-[17px] h-[17px] text-[#1C244B]" />,
  geplant: <Circle className="w-[17px] h-[17px] text-gray-300" />,
  storniert: <Circle className="w-[17px] h-[17px] text-gray-300" />,
};

const STATE_TEXT: Record<InstalmentUiState, string> = {
  bezahlt: "text-gray-500",
  in_pruefung: "text-gray-900",
  ueberfaellig: "text-gray-900",
  offen: "text-gray-900",
  geplant: "text-gray-400",
  storniert: "text-gray-300 line-through",
};

export type ZahlungsplanProps = {
  plan: PlanSummary;
  packageLabel: string;
  packageId: string;
  /** Fällig-Rechnung der nächsten Rate, falls schon gestellt. */
  nextTwintLink: string | null;
  autoRenew: boolean;
  /** ISO-Tag, bis zu dem gekündigt werden kann. */
  cancellationDeadline: string | null;
  canCancel: boolean;
};

export default function ZahlungsplanCard({
  plan,
  packageLabel,
  packageId,
  nextTwintLink,
  autoRenew,
  cancellationDeadline,
  canCancel,
}: ZahlungsplanProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (plan.entries.length === 0) return null;

  const fertig = plan.next === null;

  function toggleRenew() {
    setError(null);
    startTransition(async () => {
      const res = await setAutoRenew(packageId, !autoRenew);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      {/* Kopf */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center flex-shrink-0">
            <CalendarClock className="w-5 h-5 text-navy-900" />
          </div>
          <div>
            <p className="font-700 text-gray-900">Zahlungsplan</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {packageLabel} · {formatCHF(plan.total)}
            </p>
          </div>
        </div>
        <span
          className={`text-xs font-600 px-2.5 py-1 rounded-lg whitespace-nowrap ${
            plan.hasOverdue
              ? "bg-red-50 text-red-700"
              : fertig
              ? "bg-emerald-50 text-emerald-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {plan.hasOverdue
            ? `${plan.overdueCount} überfällig`
            : fertig
            ? "Vollständig bezahlt"
            : "Auf Kurs"}
        </span>
      </div>

      {/* Fortschritt */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm mb-1.5">
          <span className="text-gray-500">
            {plan.paidCount} von {plan.totalCount} bezahlt
          </span>
          <span className="text-gray-500">
            {formatCHF(plan.paidAmount)} von {formatCHF(plan.total)}
          </span>
        </div>
        <div
          className="h-1.5 bg-gray-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={plan.percentPaid}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Bezahlter Anteil"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              plan.hasOverdue ? "bg-red-500" : "bg-emerald-500"
            }`}
            style={{ width: `${plan.percentPaid}%` }}
          />
        </div>
      </div>

      {/* Nächste Rate */}
      {plan.next && (
        <div
          className={`mt-5 rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${
            plan.next.state === "ueberfaellig" ? "bg-red-50" : "bg-navy-50"
          }`}
        >
          <div className="min-w-0">
            <p
              className={`text-xs font-600 ${
                plan.next.state === "ueberfaellig"
                  ? "text-red-700"
                  : "text-navy-900/70"
              }`}
            >
              {plan.next.label} ·{" "}
              {dueLabel(
                plan.next.daysUntilDue,
                plan.next.state === "ueberfaellig"
              )}
            </p>
            <p className="text-[15px] font-700 text-navy-900 mt-0.5">
              {formatCHF(plan.next.amount)}
              <span className="font-400 text-gray-500 text-sm">
                {" "}
                · {formatDay(plan.next.dueDate)}
              </span>
            </p>
          </div>
          {nextTwintLink && (
            <a
              href={nextTwintLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-600 bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-navy-900/40 transition-colors whitespace-nowrap"
            >
              Mit TWINT zahlen
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {!plan.next && (
        <p className="mt-5 text-sm text-gray-500">
          Alle Raten sind beglichen. Vielen Dank!
        </p>
      )}

      {/* Alle Raten */}
      <ul className="mt-5 border-t border-gray-100">
        {plan.entries.map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-2.5 py-2.5 border-b border-gray-100 last:border-b-0"
          >
            <span className="flex-shrink-0">{STATE_ICON[e.state]}</span>
            <span
              className={`flex-1 text-sm min-w-0 ${STATE_TEXT[e.state]} ${
                e.isNext ? "font-600" : ""
              }`}
            >
              {e.label}
              <span className="text-gray-400 font-400"> · {formatDay(e.dueDate)}</span>
              {e.state === "in_pruefung" && (
                <span className="text-amber-600 font-400"> · in Prüfung</span>
              )}
            </span>
            <span
              className={`text-sm tabular-nums ${
                e.state === "geplant" ? "text-gray-400" : "text-gray-600"
              } ${e.isNext ? "font-600 text-gray-900" : ""}`}
            >
              {formatCHF(e.amount)}
            </span>
          </li>
        ))}
      </ul>

      {plan.openAmount > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-gray-500">Noch offen</span>
          <span className="font-700 text-navy-900">
            {formatCHF(plan.openAmount)}
          </span>
        </div>
      )}

      {/* Automatische Verlängerung */}
      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-600 text-gray-900 flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
            Automatisch verlängern
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {autoRenew
              ? canCancel && cancellationDeadline
                ? `Kündbar bis ${formatDay(cancellationDeadline)}`
                : "Kündigungsfrist abgelaufen – melde dich bei mir"
              : "Dein Paket läuft am Ende der Laufzeit aus"}
          </p>
        </div>
        <button
          onClick={toggleRenew}
          disabled={isPending || (autoRenew && !canCancel)}
          aria-pressed={autoRenew}
          className="flex-shrink-0 text-xs font-600 px-3 py-2 rounded-lg border border-gray-200 hover:border-navy-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : autoRenew ? (
            "Abschalten"
          ) : (
            "Einschalten"
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
