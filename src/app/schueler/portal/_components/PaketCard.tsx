import { Package, CheckCircle2, AlertCircle, PauseCircle, Clock, XCircle } from "lucide-react";
import { formatCHF } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  type Package as Paket,
  type EffectiveStatus,
  PACKAGE_LABELS,
  computePackageState,
  formatRemainingTime,
} from "@/lib/packages";

const STATUS_ICON: Record<EffectiveStatus, React.ReactNode> = {
  kein_paket: <AlertCircle className="w-3 h-3" />,
  aktiv: <CheckCircle2 className="w-3 h-3" />,
  pausiert: <PauseCircle className="w-3 h-3" />,
  aufgebraucht: <Clock className="w-3 h-3" />,
  abgelaufen: <XCircle className="w-3 h-3" />,
  storniert: <XCircle className="w-3 h-3" />,
};

export default function PaketCard({
  paket,
  lessonsUsed,
  upcomingAbsence,
}: {
  paket: Paket | null;
  lessonsUsed?: number;
  upcomingAbsence?: { start_date: string; end_date: string; title: string } | null;
}) {
  const state = computePackageState(paket, lessonsUsed);

  if (!paket) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <p className="font-600 text-gray-900">Kein aktives Paket</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Buche unten ein neues Paket, um mit den Lektionen zu starten.
          </p>
        </div>
      </div>
    );
  }

  const timerText =
    state.effectiveStatus === "pausiert"
      ? "Pausiert"
      : state.effectiveStatus === "abgelaufen"
      ? "Abgelaufen"
      : state.remainingMs != null
      ? `Läuft in ${formatRemainingTime(state.remainingMs)} ab`
      : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1C244B]/10 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-[#1C244B]" />
          </div>
          <div>
            <p className="font-700 text-gray-900">
              {paket.name ?? PACKAGE_LABELS[paket.type] ?? paket.type}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatCHF(Number(paket.price_per_lesson))} pro Lektion
            </p>
          </div>
        </div>
        <StatusBadge
          kind="packageState"
          status={state.effectiveStatus}
          icon={STATUS_ICON[state.effectiveStatus]}
        />
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Lektionen genutzt</span>
          <span className="font-600 text-gray-900">
            {state.lessonsUsed} / {state.lessonsTotal}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-[#1C244B] transition-all duration-500"
            style={{ width: `${state.progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Verbleibend</span>
          <span className="font-700 text-[#1C244B]">
            {state.lessonsRemaining} Lektion{state.lessonsRemaining !== 1 ? "en" : ""}
          </span>
        </div>

        {timerText && (
          <div className="flex justify-between text-sm pt-1 border-t border-gray-100">
            <span className="text-gray-500">Laufzeit</span>
            <span
              className={`font-500 ${
                state.effectiveStatus === "abgelaufen"
                  ? "text-red-600"
                  : state.effectiveStatus === "pausiert"
                  ? "text-blue-600"
                  : "text-gray-700"
              }`}
            >
              {timerText}
            </span>
          </div>
        )}

        {paket.expires_at && state.effectiveStatus !== "pausiert" && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Gültig bis</span>
            <span className="font-500 text-gray-700">
              {new Date(paket.expires_at).toLocaleDateString("de-CH", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        )}
      </div>

      {upcomingAbsence && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
          <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Kommende Abwesenheit:{" "}
            {new Date(upcomingAbsence.start_date).toLocaleDateString("de-CH", {
              day: "numeric",
              month: "short",
            })}{" "}
            –{" "}
            {new Date(upcomingAbsence.end_date).toLocaleDateString("de-CH", {
              day: "numeric",
              month: "short",
            })}
            . Deine Laufzeit wird automatisch verlängert.
          </span>
        </div>
      )}
    </div>
  );
}
