"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, List, Clock } from "lucide-react";

export type EntryVM = {
  id: string;
  name: string;
  status: string;
  timeRange: string;
  dateShort: string;
  beginn: string;
};

export type DayVM = {
  key: string;
  dayNum: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  entries: EntryVM[];
};

type View = "monat" | "liste";

function statusClasses(status: string): string {
  return status === "completed"
    ? "bg-emerald-100 text-emerald-800"
    : status === "angefragt"
      ? "bg-amber-100 text-amber-800"
      : "bg-[#1C244B]/10 text-[#1C244B]";
}

function statusDot(status: string): string {
  return status === "completed"
    ? "bg-emerald-500"
    : status === "angefragt"
      ? "bg-amber-500"
      : "bg-[#1C244B]";
}

function statusLabel(status: string): string {
  return status === "angefragt"
    ? "Anfrage"
    : status === "completed"
      ? "Abgehalten"
      : "Gebucht";
}

function defaultSelectedKey(days: DayVM[]): string {
  const today = days.find((d) => d.isToday && d.isCurrentMonth);
  if (today) return today.key;
  const firstWithEntries = days.find((d) => d.isCurrentMonth && d.entries.length > 0);
  if (firstWithEntries) return firstWithEntries.key;
  const firstOfMonth = days.find((d) => d.isCurrentMonth);
  return firstOfMonth?.key ?? days[0]?.key ?? "";
}

export default function KalenderView({
  days,
  weekdays,
  agenda,
}: {
  days: DayVM[];
  weekdays: string[];
  agenda: EntryVM[];
}) {
  const [view, setView] = useState<View>("monat");
  const [selectedKey, setSelectedKey] = useState<string>(() => defaultSelectedKey(days));

  // Beim Monatswechsel (neue Daten vom Server) die Auswahl zurücksetzen.
  const gridSignature = days[0]?.key ?? "";
  useEffect(() => {
    setSelectedKey(defaultSelectedKey(days));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridSignature]);

  const selectedDay = useMemo(
    () => days.find((d) => d.key === selectedKey) ?? null,
    [days, selectedKey]
  );

  const TABS: { id: View; label: string; icon: typeof CalendarDays }[] = [
    { id: "monat", label: "Monat", icon: CalendarDays },
    { id: "liste", label: "Liste", icon: List },
  ];
  const activeIdx = TABS.findIndex((t) => t.id === view);

  return (
    <div className="space-y-4">
      {/* Segmented toggle */}
      <div className="relative inline-flex rounded-xl bg-gray-100 p-1 w-full sm:w-auto">
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

      <div key={view} className="animate-enter-up">
        {view === "monat" ? (
          <MonthGrid
            days={days}
            weekdays={weekdays}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            selectedDay={selectedDay}
          />
        ) : (
          <Liste agenda={agenda} />
        )}
      </div>
    </div>
  );
}

/* ── Monatsgitter mit Status-Punkten + Tages-Detailpanel ──────────────────── */
function MonthGrid({
  days,
  weekdays,
  selectedKey,
  onSelect,
  selectedDay,
}: {
  days: DayVM[];
  weekdays: string[];
  selectedKey: string;
  onSelect: (key: string) => void;
  selectedDay: DayVM | null;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-2 sm:p-3">
        {/* Wochentage */}
        <div className="grid grid-cols-7 mb-1">
          {weekdays.map((w) => (
            <div
              key={w}
              className="text-center text-[11px] font-700 uppercase tracking-wide text-gray-400 py-1.5"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Tage */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const isSelected = d.key === selectedKey;
            const count = d.entries.length;
            return (
              <button
                key={d.key}
                onClick={() => onSelect(d.key)}
                className={`press relative aspect-square sm:aspect-[5/4] rounded-xl flex flex-col items-center justify-start pt-1.5 transition-colors ${
                  isSelected
                    ? "bg-[#1C244B] text-white shadow-sm"
                    : d.isToday
                      ? "bg-[#1C244B]/8"
                      : "hover:bg-gray-100"
                } ${!d.isCurrentMonth ? "opacity-35" : ""}`}
              >
                <span
                  className={`text-[13px] sm:text-sm font-700 leading-none ${
                    isSelected
                      ? "text-white"
                      : d.isToday
                        ? "text-[#1C244B]"
                        : "text-gray-700"
                  }`}
                >
                  {d.dayNum}
                </span>

                {/* Status-Punkte */}
                {count > 0 && (
                  <span className="absolute bottom-1.5 flex items-center justify-center gap-0.5">
                    {d.entries.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? "bg-white/80" : statusDot(e.status)
                        }`}
                      />
                    ))}
                    {count > 3 && (
                      <span
                        className={`text-[8px] font-700 leading-none ${
                          isSelected ? "text-white/80" : "text-gray-400"
                        }`}
                      >
                        +{count - 3}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail des ausgewählten Tages */}
      <DayDetail day={selectedDay} />
    </div>
  );
}

function DayDetail({ day }: { day: DayVM | null }) {
  if (!day) return null;

  const dateLabel = new Date(`${day.key}T12:00:00`).toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <CalendarDays className="w-4 h-4 text-[#1C244B]" />
        <span className="text-sm font-700 text-[#1C244B] capitalize">{dateLabel}</span>
        {day.isToday && (
          <span className="text-[11px] font-600 text-[#1C244B]/60 ml-auto">Heute</span>
        )}
      </div>

      {day.entries.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-400">Keine Termine</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {day.entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex items-center gap-1.5 text-xs font-700 text-gray-500 tabular-nums w-[96px] flex-shrink-0">
                <Clock className="w-3 h-3 text-gray-300" />
                {e.timeRange}
              </span>
              <span className="text-sm font-500 text-gray-900 flex-1 truncate">{e.name}</span>
              <span
                className={`text-[11px] font-600 px-2 py-0.5 rounded-full flex-shrink-0 ${statusClasses(e.status)}`}
              >
                {statusLabel(e.status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Liste: chronologisch, kompakt ────────────────────────────────────────── */
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
      Keine Termine diesen Monat
    </div>
  );
}
