"use client";

import { useState } from "react";
import { CalendarDays, List } from "lucide-react";

export type EntryVM = {
  id: string;
  name: string;
  status: string;
  hour: number;
  timeRange: string;
  dateShort: string;
};

export type DayVM = {
  key: string;
  weekdayShort: string;
  dayNum: number;
  isToday: boolean;
  entries: EntryVM[];
};

type View = "kalender" | "liste";

function statusClasses(status: string): string {
  return status === "completed"
    ? "bg-emerald-100 text-emerald-800"
    : status === "angefragt"
      ? "bg-amber-100 text-amber-800"
      : "bg-[#1C244B]/10 text-[#1C244B]";
}

function statusLabel(status: string): string {
  return status === "angefragt"
    ? "Anfrage"
    : status === "completed"
      ? "Abgehalten"
      : "Gebucht";
}

export default function KalenderView({
  days,
  hours,
  agenda,
}: {
  days: DayVM[];
  hours: number[];
  agenda: EntryVM[];
}) {
  const [view, setView] = useState<View>("kalender");

  const TABS: { id: View; label: string; icon: typeof CalendarDays }[] = [
    { id: "kalender", label: "Kalender", icon: CalendarDays },
    { id: "liste", label: "Liste", icon: List },
  ];
  const activeIdx = TABS.findIndex((t) => t.id === view);

  return (
    <div className="space-y-4">
      {/* Segmented toggle */}
      <div className="relative inline-flex rounded-xl bg-gray-100 p-1 w-full sm:w-auto">
        {/* Sliding pill */}
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm transition-transform"
          style={{
            width: `calc(${100 / TABS.length}% - 4px)`,
            left: 4,
            transform: `translateX(calc(${activeIdx * 100}% + ${activeIdx * 4}px))`,
            transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
            transitionDuration: "280ms",
          }}
        />
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = view === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`press relative z-10 flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-sm font-600 transition-colors ${
                isActive ? "text-[#1C244B]" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Animated view container */}
      <div key={view} className="animate-enter-up">
        {view === "kalender" ? (
          <KalenderGrid days={days} hours={hours} />
        ) : (
          <Liste agenda={agenda} />
        )}
      </div>
    </div>
  );
}

/* ── Kalender: Wochengitter (Desktop) + Tages-Karten (Mobile) ─────────────── */
function KalenderGrid({ days, hours }: { days: DayVM[]; hours: number[] }) {
  const daysWithEntries = days.filter((d) => d.entries.length > 0);
  return (
    <>
      {/* Desktop: Zeit-Raster */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Kopfzeile */}
            <div className="grid grid-cols-8 border-b border-gray-100">
              <div className="py-3 px-3" />
              {days.map((d) => (
                <div
                  key={d.key}
                  className={`py-3 px-2 text-center border-l border-gray-100 ${d.isToday ? "bg-[#1C244B]/5" : ""}`}
                >
                  <p className={`text-xs font-600 uppercase tracking-wide ${d.isToday ? "text-[#1C244B]" : "text-gray-400"}`}>
                    {d.weekdayShort}
                  </p>
                  <p className={`text-sm font-700 mt-0.5 ${d.isToday ? "text-[#1C244B]" : "text-gray-700"}`}>
                    {d.dayNum}
                  </p>
                </div>
              ))}
            </div>

            {/* Stundenzeilen */}
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-gray-50 min-h-[52px]">
                <div className="py-2 px-3 text-xs font-500 text-gray-400 flex items-start pt-2.5">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {days.map((d) => (
                  <div
                    key={d.key}
                    className={`border-l border-gray-100 p-1 ${d.isToday ? "bg-[#1C244B]/5" : ""}`}
                  >
                    {d.entries
                      .filter((e) => e.hour === hour)
                      .map((e) => (
                        <div
                          key={e.id}
                          className={`rounded-lg px-2 py-1.5 text-xs font-500 leading-tight ${statusClasses(e.status)}`}
                        >
                          <p className="font-600 truncate">{e.name}</p>
                          <p className="opacity-70">{e.timeRange}</p>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: Tages-Karten (echtes Kalendergefühl, kein horizontales Scrollen) */}
      <div className="md:hidden space-y-3">
        {daysWithEntries.length === 0 ? (
          <EmptyState />
        ) : (
          daysWithEntries.map((d) => (
            <div
              key={d.key}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <div
                className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 ${d.isToday ? "bg-[#1C244B]/5" : "bg-gray-50/60"}`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${d.isToday ? "bg-[#1C244B] text-white" : "bg-white border border-gray-200 text-[#1C244B]"}`}
                >
                  <span className="text-[13px] font-800 leading-none">{d.dayNum}</span>
                </div>
                <div>
                  <p className="text-sm font-700 text-[#1C244B] leading-none">{d.weekdayShort}</p>
                  {d.isToday && <p className="text-[11px] text-[#1C244B]/60 mt-0.5">Heute</p>}
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {d.entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xs font-700 text-gray-500 tabular-nums w-[88px] flex-shrink-0">
                      {e.timeRange}
                    </span>
                    <span className="text-sm font-500 text-gray-900 flex-1 truncate">{e.name}</span>
                    <span className={`text-[11px] font-600 px-2 py-0.5 rounded-full flex-shrink-0 ${statusClasses(e.status)}`}>
                      {statusLabel(e.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/* ── Liste: chronologisch, kompakt, auf allen Grössen identisch ───────────── */
function Liste({ agenda }: { agenda: EntryVM[] }) {
  if (agenda.length === 0) return <EmptyState />;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-50">
      {agenda.map((e) => (
        <div key={e.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition-colors">
          <div className="w-[120px] flex-shrink-0">
            <p className="text-xs font-700 text-[#1C244B] leading-tight">{e.dateShort}</p>
            <p className="text-xs text-gray-500 tabular-nums mt-0.5">{e.timeRange}</p>
          </div>
          <span className="text-sm font-500 text-gray-900 flex-1 truncate">{e.name}</span>
          <span className={`text-[11px] font-600 px-2 py-0.5 rounded-full flex-shrink-0 ${statusClasses(e.status)}`}>
            {statusLabel(e.status)}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
      Keine Termine diese Woche
    </div>
  );
}
