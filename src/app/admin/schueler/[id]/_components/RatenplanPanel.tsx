"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  CalendarClock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatCHF } from "@/lib/utils";
import {
  dueLabel,
  formatDay,
  type InstalmentUiState,
  type PlanSummary,
} from "@/lib/instalment-view";
import { issueInstalmentNow } from "@/app/admin/actions";

const STATE_ICON: Record<InstalmentUiState, React.ReactNode> = {
  bezahlt: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  in_pruefung: <Clock className="w-4 h-4 text-amber-500" />,
  ueberfaellig: <AlertCircle className="w-4 h-4 text-red-600" />,
  offen: <Clock className="w-4 h-4 text-[#1C244B]" />,
  geplant: <Circle className="w-4 h-4 text-gray-300" />,
  storniert: <Circle className="w-4 h-4 text-gray-300" />,
};

export default function RatenplanPanel({
  plan,
  packageLabel,
  autoRenew,
  expiresOn,
}: {
  plan: PlanSummary;
  packageLabel: string;
  autoRenew: boolean;
  expiresOn: string | null;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (plan.entries.length === 0) return null;

  function stellen(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await issueInstalmentNow(id);
      if (res && "error" in res) {
        setError(res.error ?? null);
        setBusyId(null);
        return;
      }
      router.refresh();
      setBusyId(null);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-700 text-[#1C244B]">Ratenplan</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {packageLabel} · {formatCHF(plan.total)}
            {expiresOn ? ` · gültig bis ${formatDay(expiresOn)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {autoRenew && (
            <span className="inline-flex items-center gap-1.5 text-xs font-600 bg-navy-50 text-[#1C244B] px-2.5 py-1 rounded-lg">
              <RefreshCw className="w-3 h-3" />
              Verlängert sich
            </span>
          )}
          {plan.hasOverdue && (
            <span className="text-xs font-600 bg-red-50 text-red-700 px-2.5 py-1 rounded-lg whitespace-nowrap">
              {formatCHF(plan.overdueAmount)} überfällig
            </span>
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-between text-sm mb-1.5">
        <span className="text-gray-500">
          {plan.paidCount} von {plan.totalCount} bezahlt
        </span>
        <span className="text-gray-500">
          offen {formatCHF(plan.openAmount)}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full ${
            plan.hasOverdue ? "bg-red-500" : "bg-emerald-500"
          }`}
          style={{ width: `${plan.percentPaid}%` }}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}

      <ul className="divide-y divide-gray-100 border-t border-gray-100">
        {plan.entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
            <span className="flex-shrink-0">{STATE_ICON[e.state]}</span>
            <span
              className={`flex-1 text-sm min-w-0 ${
                e.state === "geplant" ? "text-gray-400" : "text-gray-900"
              } ${e.isNext ? "font-600" : ""}`}
            >
              {e.label}
              <span className="text-gray-400 font-400 block sm:inline">
                <span className="hidden sm:inline"> · </span>
                {formatDay(e.dueDate)}
              </span>
            </span>
            <span
              className={`text-sm tabular-nums whitespace-nowrap ${
                e.state === "geplant" ? "text-gray-400" : "text-gray-600"
              }`}
            >
              {formatCHF(e.amount)}
            </span>
            <span className="text-right flex-shrink-0 ml-auto sm:ml-0 sm:w-[104px]">
              {!e.invoiceId && e.state !== "bezahlt" && e.state !== "storniert" ? (
                <button
                  onClick={() => stellen(e.id)}
                  disabled={busyId === e.id}
                  className="text-xs font-600 px-3 min-h-[36px] rounded-lg border border-gray-200 active:bg-gray-50 disabled:opacity-40 transition-colors inline-flex items-center gap-1.5"
                >
                  {busyId === e.id && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  Jetzt stellen
                </button>
              ) : (
                <span className="text-xs text-gray-400">
                  {e.state === "bezahlt"
                    ? "bezahlt"
                    : e.state === "in_pruefung"
                    ? "in Prüfung"
                    : e.state === "ueberfaellig"
                    ? dueLabel(e.daysUntilDue, true)
                    : "gestellt"}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {plan.next && (
        <p className="mt-4 text-sm text-gray-500 flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5 text-gray-400" />
          Als Nächstes: {plan.next.label} über {formatCHF(plan.next.amount)} —{" "}
          {dueLabel(plan.next.daysUntilDue, plan.next.state === "ueberfaellig")}
        </p>
      )}
    </div>
  );
}
