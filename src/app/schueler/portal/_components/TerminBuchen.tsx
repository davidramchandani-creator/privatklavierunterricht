"use client";

import { useState, useTransition, useEffect } from "react";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  X,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  requestMultipleBookings,
  getVerfuegbareSlots,
  type AvailableSlot,
} from "../actions";

export default function TerminBuchen({ maxSlots }: { maxSlots: number }) {
  const [open, setOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState<AvailableSlot[]>([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingSlots(true);
    startTransition(async () => {
      const result = await getVerfuegbareSlots(weekOffset);
      setSlots(result);
      setLoadingSlots(false);
    });
  }, [open, weekOffset]);

  const slotsByDay = groupSlotsByDay(slots);
  const displayDays = getDaysInWeek(weekOffset);

  const monday = getMonday(weekOffset);
  const friday = new Date(monday.getTime() + 4 * 86400000);
  const weekLabel = `${monday.toLocaleDateString("de-CH", { day: "numeric", month: "long" })} – ${friday.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" })}`;

  function toggleSlot(slot: AvailableSlot) {
    setSelected((prev) => {
      const already = prev.find((s) => s.beginn === slot.beginn);
      if (already) return prev.filter((s) => s.beginn !== slot.beginn);
      if (prev.length >= maxSlots) return prev; // limit reached
      return [...prev, slot].sort((a, b) => a.beginn.localeCompare(b.beginn));
    });
  }

  async function handleSubmit() {
    if (!selected.length) return;
    setError(null);
    startTransition(async () => {
      const result = await requestMultipleBookings(selected.map((s) => s.beginn));
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setOpen(false);
        setSelected([]);
      }
    });
  }

  function handleClose() {
    setOpen(false);
    setSelected([]);
    setError(null);
  }

  if (success) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center text-sm text-emerald-700 font-500">
        Anfrage gesendet! David bestätigt jeden Termin einzeln, du siehst den
        Status unter „Termine“.
      </div>
    );
  }

  return (
    <div>
      {!open ? (
        /*
          Für einen Schüler, der flexibel bucht, ist das die Hauptsache auf
          dieser Seite: Ohne diesen Knopf bekommt er keine Lektion. Er stand
          hier als kleiner Umriss-Knopf unter allem anderen, während
          darüber Formulare für Dinge lagen, die ihn nicht betreffen.
          Deshalb jetzt in voller Breite und gefüllt.
        */
        <button
          onClick={() => setOpen(true)}
          className="press w-full flex items-center justify-between gap-4 bg-[#1C244B] text-white rounded-2xl px-5 py-4 hover:bg-[#2a3169] transition-colors group"
        >
          <span className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <CalendarPlus className="w-5 h-5" />
            </span>
            <span className="text-left">
              <span className="block font-700 text-sm">Lektionen anfragen</span>
              <span className="block text-white/60 text-xs mt-0.5">
                Such dir aus, wann es dir passt
              </span>
            </span>
          </span>
          <svg
            className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-600 text-gray-900 text-sm">Termine wählen</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Wähle bis zu {maxSlots} Wunschtermin{maxSlots !== 1 ? "e" : ""} aus
              </p>
            </div>
            <button onClick={handleClose} className="text-xs text-gray-400 hover:text-gray-600">
              Abbrechen
            </button>
          </div>

          {/* Selected slots list */}
          {selected.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-600 text-gray-500 uppercase tracking-wide">
                Ausgewählt ({selected.length}/{maxSlots})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selected.map((slot) => (
                  <span
                    key={slot.beginn}
                    className="inline-flex items-center gap-1 bg-[#1C244B] text-white text-xs font-500 px-2.5 py-1 rounded-lg"
                  >
                    {fmtSlot(slot.beginn)}
                    <button
                      onClick={() => toggleSlot(slot)}
                      className="ml-0.5 opacity-70 hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Week nav */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              disabled={weekOffset <= 0}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-500 text-gray-600">{weekLabel}</span>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Slots grid */}
          {loadingSlots ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#1C244B]" />
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Calendar className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Keine freien Slots diese Woche</p>
            </div>
          ) : (
            <>
              {/* Mobile: flat list grouped by day */}
              <div className="sm:hidden space-y-4">
                {displayDays.slice(0, 5).map((d) => {
                  const daySlots = slotsByDay.get(d.dateStr) ?? [];
                  if (daySlots.length === 0) return null;
                  const dayDate = new Date(d.dateStr + "T12:00:00Z");
                  return (
                    <div key={d.dateStr}>
                      <p className="text-xs font-600 text-gray-500 mb-2">
                        {dayDate.toLocaleDateString("de-CH", {
                          timeZone: "Europe/Zurich",
                          weekday: "long",
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {daySlots.map((slot) => {
                          const isSelected = selected.some((s) => s.beginn === slot.beginn);
                          const isDisabled = !isSelected && selected.length >= maxSlots;
                          const time = new Date(slot.beginn).toLocaleTimeString("de-CH", {
                            timeZone: "Europe/Zurich",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          return (
                            <button
                              key={slot.beginn}
                              onClick={() => toggleSlot(slot)}
                              disabled={isDisabled}
                              className={`relative text-sm py-2.5 px-3 rounded-xl font-500 transition-colors ${
                                isSelected
                                  ? "bg-[#1C244B] text-white"
                                  : isDisabled
                                    ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700 hover:bg-[#1C244B]/10"
                              }`}
                            >
                              {isSelected && (
                                <CheckCircle2 className="w-2.5 h-2.5 absolute top-1 right-1 text-emerald-300" />
                              )}
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: 5-column grid */}
              <div className="hidden sm:grid grid-cols-5 gap-2">
                {displayDays.slice(0, 5).map((d) => {
                  const daySlots = slotsByDay.get(d.dateStr) ?? [];
                  return (
                    <div key={d.dateStr} className="space-y-1.5">
                      <p className="text-[10px] font-600 text-gray-400 text-center uppercase tracking-wide">
                        {d.label}
                      </p>
                      {daySlots.length === 0 ? (
                        <p className="text-[10px] text-gray-300 text-center mt-2">—</p>
                      ) : (
                        daySlots.map((slot) => {
                          const isSelected = selected.some((s) => s.beginn === slot.beginn);
                          const isDisabled = !isSelected && selected.length >= maxSlots;
                          const time = new Date(slot.beginn).toLocaleTimeString("de-CH", {
                            timeZone: "Europe/Zurich",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          return (
                            <button
                              key={slot.beginn}
                              onClick={() => toggleSlot(slot)}
                              disabled={isDisabled}
                              className={`w-full text-xs py-1.5 rounded-lg font-500 transition-colors relative ${
                                isSelected
                                  ? "bg-[#1C244B] text-white"
                                  : isDisabled
                                    ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700 hover:bg-[#1C244B]/10"
                              }`}
                            >
                              {isSelected && (
                                <CheckCircle2 className="w-2.5 h-2.5 absolute top-1 right-1 text-emerald-300" />
                              )}
                              {time}
                            </button>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={selected.length === 0 || isPending}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Anfrage senden…
              </>
            ) : selected.length > 0 ? (
              `${selected.length} Termin${selected.length !== 1 ? "e" : ""} anfragen`
            ) : (
              "Zeitfenster wählen"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function fmtSlot(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }) + " Uhr";
}

function getMonday(weekOffset: number): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

type DayInfo = { dateStr: string; label: string };

/** Zürcher Kalenderdatum (YYYY-MM-DD) eines Instants, DST-sicher. */
function zurichDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function getDaysInWeek(weekOffset: number): DayInfo[] {
  const monday = getMonday(weekOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * 86400000);
    return {
      // Schlüssel = Zürcher Datum, damit er zu den Slot-Schlüsseln passt.
      dateStr: zurichDateKey(d),
      label: d.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich", weekday: "short" }),
    };
  });
}

function groupSlotsByDay(slots: AvailableSlot[]): Map<string, AvailableSlot[]> {
  const map = new Map<string, AvailableSlot[]>();
  for (const slot of slots) {
    // Slots nach Zürcher Datum gruppieren (nicht nach UTC-Datum des ISO-Strings).
    const dateStr = zurichDateKey(new Date(slot.beginn));
    if (!map.has(dateStr)) map.set(dateStr, []);
    map.get(dateStr)!.push(slot);
  }
  return map;
}
