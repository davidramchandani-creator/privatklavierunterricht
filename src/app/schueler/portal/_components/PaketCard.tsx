import {
  Package,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  Clock,
  XCircle,
  CalendarRange,
} from "lucide-react";
import { formatCHF } from "@/lib/utils";
import { istKuendbar, kuendigungsfrist } from "@/lib/abo";
import { describeFixplatz } from "@/lib/fixplatz";
import { todayInZurich } from "@/lib/subscription";
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
      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <p className="font-600 text-gray-900">Noch kein Abo</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Schliesse unten ein Abo ab, um mit dem Unterricht zu starten.
          </p>
        </div>
      </div>
    );
  }

  // Abos werden anders dargestellt als die alten Lektionspakete: Was zählt,
  // ist die laufende Periode und der Monatsbetrag – nicht ein Lektionszähler,
  // der gegen null läuft. Ein Abo geht ja weiter.
  if (paket.abo_variante) {
    return (
      <AboKarte
        paket={paket}
        lessonsUsed={state.lessonsUsed}
        upcomingAbsence={upcomingAbsence}
      />
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
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-navy-900" />
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
                  ? "text-amber-600"
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
                timeZone: "Europe/Zurich",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        )}
      </div>

      {upcomingAbsence && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-navy-50 px-3 py-2.5 text-xs text-navy-900">
          <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Kommende Abwesenheit:{" "}
            {new Date(upcomingAbsence.start_date).toLocaleDateString("de-CH", {
              timeZone: "Europe/Zurich",
              day: "numeric",
              month: "short",
            })}{" "}
            –{" "}
            {new Date(upcomingAbsence.end_date).toLocaleDateString("de-CH", {
              timeZone: "Europe/Zurich",
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

/**
 * Darstellung eines laufenden Abos.
 *
 * Bewusst ohne den Lektionszähler des alten Paketmodells. Bei einem Abo läuft
 * nichts gegen null – gekauft ist die Laufzeit, und was zählt, ist wie weit
 * die Periode fortgeschritten ist und was monatlich läuft.
 */
function AboKarte({
  paket,
  lessonsUsed,
  upcomingAbsence,
}: {
  paket: Paket;
  lessonsUsed: number;
  upcomingAbsence?: { start_date: string; end_date: string; title: string } | null;
}) {
  const heute = todayInZurich();
  const start = paket.periode_start ?? null;
  const ende = paket.periode_ende ?? null;

  const fortschritt =
    start && ende
      ? Math.min(
          100,
          Math.max(
            0,
            ((Date.parse(`${heute}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
              (Date.parse(`${ende}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`))) *
              100
          )
        )
      : 0;

  const gesamtLektionen = paket.abo_lektionen ?? paket.lessons_total;
  const kuendbar = ende ? istKuendbar(ende, heute) : false;
  const frist = ende ? kuendigungsfrist(ende) : null;

  const datum = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-CH", {
      timeZone: "Europe/Zurich",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  // Drei Fälle, und alle drei müssen stimmen:
  //
  //   1. Fixplatz steht     → der konkrete Termin
  //   2. Fixplatz vereinbart, Termin noch offen → ehrlich sagen, dass er kommt
  //   3. Flexibel           → frei wählbar
  //
  // Fall 2 fiel vorher in den Flex-Zweig und las sich als „Jede Woche, frei
  // wählbar". Das ist falsch: der Schüler hat gar keine freie Wahl, sein
  // Termin kommt aus der Zuteilung. Er hätte vergeblich nach einem
  // Buchungsknopf gesucht.
  const fixplatzText =
    paket.booking_mode === "fix" &&
    paket.fixplatz_weekday != null &&
    paket.fixplatz_time
      ? describeFixplatz(
          Number(paket.fixplatz_weekday),
          String(paket.fixplatz_time),
          paket.rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich",
          paket.fixplatz_week_parity == null
            ? null
            : ((Number(paket.fixplatz_week_parity) === 1 ? 1 : 0) as 0 | 1)
        )
      : paket.booking_mode === "fix"
        ? paket.rhythmus === "zweiwoechentlich"
          ? "Fester Termin alle zwei Wochen – wird noch festgelegt"
          : "Fester Termin jede Woche – wird noch festgelegt"
        : paket.rhythmus === "zweiwoechentlich"
          ? "Alle zwei Wochen, frei wählbar"
          : "Jede Woche, frei wählbar";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center flex-shrink-0">
            <CalendarRange className="w-5 h-5 text-navy-900" />
          </div>
          <div className="min-w-0">
            <p className="font-700 text-gray-900 truncate">
              {paket.name ?? "Abo"}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">{fixplatzText}</p>
          </div>
        </div>
        {paket.monatsbetrag != null && (
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-800 text-[#1C244B] tabular-nums">
              {formatCHF(Number(paket.monatsbetrag))}
            </p>
            <p className="text-xs text-gray-400">pro Monat</p>
          </div>
        )}
      </div>

      {start && ende && (
        <div className="mt-5">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-gray-500">Laufende Periode</span>
            <span className="font-600 text-gray-900">
              {lessonsUsed} von {gesamtLektionen} Lektionen
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-[#1C244B] transition-all duration-500"
              style={{ width: `${fortschritt}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1.5">
            <span>{datum(start)}</span>
            <span>{datum(ende)}</span>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm">
        {paket.auto_renew ? (
          <div className="flex items-start justify-between gap-4">
            <span className="text-gray-500 flex-shrink-0">Danach</span>
            <span className="font-500 text-gray-700 text-right">
              {ende ? `Verlängert sich am ${datum(ende)}` : "Verlängert sich"}
            </span>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <span className="text-gray-500 flex-shrink-0">Danach</span>
            <span className="font-500 text-amber-700 text-right">
              Endet {ende ? `am ${datum(ende)}` : ""}
            </span>
          </div>
        )}

        {paket.auto_renew && frist && (
          <div className="flex items-start justify-between gap-4">
            <span className="text-gray-500 flex-shrink-0">Kündbar</span>
            <span
              className={`font-500 text-right ${
                kuendbar ? "text-gray-700" : "text-amber-700"
              }`}
            >
              {kuendbar ? `bis ${datum(frist)}` : "Frist abgelaufen"}
            </span>
          </div>
        )}
      </div>

      {upcomingAbsence && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-navy-50 px-3 py-2.5 text-xs text-navy-900">
          <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Kommende Abwesenheit:{" "}
            {new Date(upcomingAbsence.start_date).toLocaleDateString("de-CH", {
              timeZone: "Europe/Zurich",
              day: "numeric",
              month: "short",
            })}{" "}
            –{" "}
            {new Date(upcomingAbsence.end_date).toLocaleDateString("de-CH", {
              timeZone: "Europe/Zurich",
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
      )}
    </div>
  );
}
