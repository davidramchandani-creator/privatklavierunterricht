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

export default function RatenBoard({ zeilen }: { zeilen: RatenZeile[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterId>("faellig");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const stats = useMemo(() => {
    const heute = new Date();
    const monatsEnde = new Date(
      heute.getFullYear(),
      heute.getMonth() + 1,
      0
    ).toISOString().slice(0, 10);

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
      setBusyId(null);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  if (zeilen.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-8 text-center">
        <CalendarClock className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="font-600 text-[#1C244B]">Noch keine Ratenpläne</p>
        <p className="text-sm text-gray-500 mt-1">
          Sobald ein Schüler ein Paket auf Raten kauft, erscheint der Plan hier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Kennzahlen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-[#EAECEF] p-4">
          <p className="text-[13px] text-gray-500">Überfällig</p>
          <p className="text-2xl font-700 text-red-600 mt-1 tabular-nums">
            {formatCHF(stats.ueberfaellig)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#EAECEF] p-4">
          <p className="text-[13px] text-gray-500">Diesen Monat fällig</p>
          <p className="text-2xl font-700 text-[#1C244B] mt-1 tabular-nums">
            {formatCHF(stats.diesenMonat)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-[#EAECEF] p-4">
          <p className="text-[13px] text-gray-500">Noch ausstehend</p>
          <p className="text-2xl font-700 text-[#1C244B] mt-1 tabular-nums">
            {formatCHF(stats.ausstehend)}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-sm font-600 px-3.5 py-2 rounded-xl whitespace-nowrap border transition-colors ${
              filter === f.id
                ? "bg-[#1C244B] text-white border-[#1C244B]"
                : "bg-white text-gray-600 border-[#EAECEF] hover:border-[#1C244B]/40"
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

      {/* Liste */}
      <div className="bg-white rounded-2xl border border-[#EAECEF] divide-y divide-[#EAECEF]">
        {sichtbar.length === 0 && (
          <p className="p-6 text-sm text-gray-500 text-center">
            Hier ist gerade nichts.
          </p>
        )}
        {sichtbar.map((z) => (
          <div key={z.id} className="flex items-center gap-3 p-4">
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
              <p className="text-sm text-gray-900 truncate">
                <Link
                  href={`/admin/schueler/${z.studentId}`}
                  className="font-600 hover:underline"
                >
                  {z.studentName}
                </Link>
                <span className="text-gray-400"> · {z.label}</span>
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  z.state === "ueberfaellig" ? "text-red-600" : "text-gray-500"
                }`}
              >
                {z.state === "bezahlt"
                  ? `Bezahlt · ${formatDay(z.dueDate)}`
                  : z.state === "in_pruefung"
                  ? `Zahlung gemeldet · ${formatDay(z.dueDate)}`
                  : `${dueLabel(z.daysUntilDue, z.state === "ueberfaellig")} · ${formatDay(z.dueDate)}`}
              </p>
            </div>

            <span className="text-sm text-gray-700 tabular-nums whitespace-nowrap">
              {formatCHF(z.amount)}
            </span>

            <div className="flex-shrink-0 w-[104px] text-right">
              {!z.invoiceId && z.state !== "bezahlt" && z.state !== "storniert" ? (
                <button
                  onClick={() => stellen(z.id)}
                  disabled={isPending && busyId === z.id}
                  className="text-xs font-600 px-3 py-1.5 rounded-lg border border-[#EAECEF] hover:border-[#1C244B]/40 disabled:opacity-40 transition-colors inline-flex items-center gap-1.5"
                >
                  {isPending && busyId === z.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : null}
                  Jetzt stellen
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                  {STATE_ICON[z.state]}
                  {z.state === "bezahlt"
                    ? "bezahlt"
                    : z.state === "in_pruefung"
                    ? "in Prüfung"
                    : "gestellt"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
