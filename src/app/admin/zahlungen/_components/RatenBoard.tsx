"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { formatCHF } from "@/lib/utils";
import { dueLabel, formatDay, type InstalmentUiState } from "@/lib/instalment-view";
import { issueInstalmentNow } from "@/app/admin/actions";

export type RatenZeile = {
  id: string;
  studentId: string;
  studentName: string;
  packageLabel: string;
  label: string;
  amount: number;
  dueDate: string;
  state: InstalmentUiState;
  daysUntilDue: number;
  invoiceId: string | null;
};

const FILTERS = [
  { id: "faellig", label: "Zu erledigen" },
  { id: "ueberfaellig", label: "Überfällig" },
  { id: "geplant", label: "Geplant" },
  { id: "bezahlt", label: "Bezahlt" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function matches(z: RatenZeile, f: FilterId): boolean {
  switch (f) {
    case "faellig":
      return z.state === "ueberfaellig" || z.state === "offen" || z.state === "in_pruefung";
    case "ueberfaellig":
      return z.state === "ueberfaellig";
    case "geplant":
      return z.state === "geplant";
    case "bezahlt":
      return z.state === "bezahlt";
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? "")
    .join("");
}

const STATE_ICON: Record<InstalmentUiState, React.ReactNode> = {
  bezahlt: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  in_pruefung: <Clock className="w-4 h-4 text-amber-500" />,
  ueberfaellig: <AlertCircle className="w-4 h-4 text-red-600" />,
  offen: <Clock className="w-4 h-4 text-[#1C244B]" />,
  geplant: <CalendarClock className="w-4 h-4 text-gray-300" />,
  storniert: <CalendarClock className="w-4 h-4 text-gray-300" />,
};

const STATE_TEXT: Record<InstalmentUiState, string> = {
  bezahlt: "bezahlt",
  in_pruefung: "in Prüfung",
  ueberfaellig: "gestellt",
  offen: "gestellt",
  geplant: "geplant",
  storniert: "storniert",
};

export default function RatenBoard({ zeilen }: { zeilen: RatenZeile[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterId>("faellig");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stats = useMemo(() => {
    const heute = new Date();
    const monatsEnde = new Date(heute.getFullYear(), heute.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    let ueberfaellig = 0;
    let diesenMonat = 0;
    let ausstehend = 0;
    for (const z of zeilen) {
      if (z.state === "ueberfaellig") ueberfaellig += z.amount;
      if (z.state !== "bezahlt" && z.state !== "storniert") {
        ausstehend += z.amount;
        if (z.dueDate <= monatsEnde) diesenMonat += z.amount;
      }
    }
    return { ueberfaellig, diesenMonat, ausstehend };
  }, [zeilen]);

  const counts = useMemo(() => {
    const c = { faellig: 0, ueberfaellig: 0, geplant: 0, bezahlt: 0 };
    for (const z of zeilen) {
      for (const f of FILTERS) if (matches(z, f.id)) c[f.id]++;
    }
    return c;
  }, [zeilen]);

  const sichtbar = useMemo(
    () =>
      zeilen
        .filter((z) => matches(z, filter))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [zeilen, filter]
  );

  function stellen(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await issueInstalmentNow(id);
      if (res && "error" in res) {
        setError(res.error);
        setBusyId(null);
        return;
      }
      // Erst die Serverdaten neu laden, dann den Spinner beenden – sonst
      // springt die Zeile kurz auf den alten Stand zurück.
      router.refresh();
      setBusyId(null);
    });
  }

  if (zeilen.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 sm:p-8 text-center">
        <CalendarClock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="font-600 text-[#1C244B]">Noch keine Ratenpläne</p>
        <p className="text-sm text-gray-500 mt-1">
          Sobald ein Schüler ein Paket auf Raten kauft, erscheint der Plan hier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Kennzahlen – auf dem Handy 2 Spalten, "ausstehend" volle Breite */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div className="bg-white rounded-2xl border border-[#EAECEF] p-3.5 sm:p-4">
          <p className="text-xs sm:text-[13px] text-gray-500">Überfällig</p>
          <p className="text-lg sm:text-2xl font-700 text-red-600 mt-1 tabular-nums break-words">
            {formatCHF(stats.ueberfaellig)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#EAECEF] p-3.5 sm:p-4">
          <p className="text-xs sm:text-[13px] text-gray-500">Diesen Monat</p>
          <p className="text-lg sm:text-2xl font-700 text-[#1C244B] mt-1 tabular-nums break-words">
            {formatCHF(stats.diesenMonat)}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl border border-[#EAECEF] p-3.5 sm:p-4">
          <p className="text-xs sm:text-[13px] text-gray-500">Noch ausstehend</p>
          <p className="text-lg sm:text-2xl font-700 text-[#1C244B] mt-1 tabular-nums break-words">
            {formatCHF(stats.ausstehend)}
          </p>
        </div>
      </div>

      {/* Filter – horizontal scrollbar auf schmalen Displays */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-sm font-600 px-3.5 min-h-[44px] rounded-xl whitespace-nowrap border transition-colors flex-shrink-0 ${
              filter === f.id
                ? "bg-[#1C244B] text-white border-[#1C244B]"
                : "bg-white text-gray-600 border-[#EAECEF]"
            }`}
          >
            {f.label}
            <span className={filter === f.id ? "text-white/60" : "text-gray-400"}>
              {" "}
              {counts[f.id]}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="bg-white rounded-2xl border border-[#EAECEF] divide-y divide-[#EAECEF]">
        {sichtbar.length === 0 && (
          <p className="p-6 text-sm text-gray-500 text-center">
            Hier ist gerade nichts.
          </p>
        )}

        {sichtbar.map((z) => {
          const offen =
            !z.invoiceId && z.state !== "bezahlt" && z.state !== "storniert";
          return (
            <div key={z.id} className="p-3.5 sm:p-4">
              {/* Zeile 1: Person + Betrag */}
              <div className="flex items-start gap-3">
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-700 flex-shrink-0 ${
                    z.state === "ueberfaellig"
                      ? "bg-red-50 text-red-700"
                      : z.state === "bezahlt"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-navy-50 text-[#1C244B]"
                  }`}
                >
                  {initials(z.studentName)}
                </span>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/admin/schueler/${z.studentId}`}
                    className="text-sm font-600 text-gray-900 hover:underline block truncate"
                  >
                    {z.studentName}
                  </Link>
                  <p className="text-xs text-gray-500 truncate">
                    {z.label} · {z.packageLabel}
                  </p>
                </div>

                <span className="text-sm font-600 text-gray-900 tabular-nums whitespace-nowrap">
                  {formatCHF(z.amount)}
                </span>
              </div>

              {/* Zeile 2: Fälligkeit + Aktion */}
              <div className="flex items-center justify-between gap-3 mt-2 pl-12">
                <p
                  className={`text-xs min-w-0 truncate ${
                    z.state === "ueberfaellig" ? "text-red-600" : "text-gray-500"
                  }`}
                >
                  {z.state === "bezahlt"
                    ? `Bezahlt · ${formatDay(z.dueDate)}`
                    : z.state === "in_pruefung"
                    ? `Zahlung gemeldet · ${formatDay(z.dueDate)}`
                    : `${dueLabel(z.daysUntilDue, z.state === "ueberfaellig")} · ${formatDay(z.dueDate)}`}
                </p>

                {offen ? (
                  <button
                    onClick={() => stellen(z.id)}
                    disabled={busyId === z.id}
                    className="text-xs font-600 px-3 min-h-[36px] rounded-lg border border-[#EAECEF] active:bg-gray-50 disabled:opacity-40 transition-colors inline-flex items-center gap-1.5 flex-shrink-0"
                  >
                    {busyId === z.id && <Loader2 className="w-3 h-3 animate-spin" />}
                    Jetzt stellen
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0">
                    {STATE_ICON[z.state]}
                    {STATE_TEXT[z.state]}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
