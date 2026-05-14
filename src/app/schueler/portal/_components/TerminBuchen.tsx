"use client";

import { useState, useTransition, useEffect } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buchTermin, getVerfuegbareSlots, type AvailableSlot } from "../actions";

export default function TerminBuchen({
  schueler_id,
  paket_id,
}: {
  schueler_id: string;
  paket_id: string;
}) {
  const [open, setOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Fetch real slots when week changes
  useEffect(() => {
    if (!open) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    startTransition(async () => {
      const result = await getVerfuegbareSlots(weekOffset);
      setSlots(result);
      setLoadingSlots(false);
    });
  }, [open, weekOffset]);

  // Group slots by day-of-week index (0=Mon, ..., 6=Sun)
  const slotsByDay = groupSlotsByDay(slots);

  // Determine which days have slots
  const daysWithSlots = getDaysInWeek(weekOffset).filter(
    (d) => (slotsByDay.get(d.dateStr)?.length ?? 0) > 0
  );
  const displayDays = getDaysInWeek(weekOffset);

  const monday = getMonday(weekOffset);
  const friday = new Date(monday.getTime() + 4 * 86400000);
  const weekLabel = `${monday.toLocaleDateString("de-CH", {
    day: "numeric",
    month: "long",
  })} – ${friday.toLocaleDateString("de-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;

  async function handleBuchen() {
    if (!selectedSlot) return;
    setError(null);
    startTransition(async () => {
      const result = await buchTermin(
        schueler_id,
        paket_id,
        selectedSlot.beginn,
        selectedSlot.ende
      );
      if (result?.error) setError(result.error);
      else {
        setSuccess(true);
        setOpen(false);
        setSelectedSlot(null);
      }
    });
  }

  if (success) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center text-sm text-emerald-700 font-500">
        Lektion erfolgreich gebucht! Seite neu laden um sie zu sehen.
      </div>
    );
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm font-600 text-[#3730A3] px-4 py-2.5 rounded-xl border border-[#3730A3]/20 hover:bg-[#3730A3]/5 transition-colors"
        >
          <CalendarPlus className="w-4 h-4" />
          Neue Lektion buchen
        </button>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-600 text-gray-900 text-sm">Lektion buchen</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Abbrechen
            </button>
          </div>

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
              <Loader2 className="w-5 h-5 animate-spin text-[#3730A3]" />
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Calendar className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Keine freien Slots diese Woche</p>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
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
                        const isSelected = selectedSlot?.beginn === slot.beginn;
                        const time = new Date(slot.beginn).toLocaleTimeString(
                          "de-CH",
                          { hour: "2-digit", minute: "2-digit" }
                        );
                        return (
                          <button
                            key={slot.beginn}
                            onClick={() =>
                              setSelectedSlot(isSelected ? null : slot)
                            }
                            className={`w-full text-xs py-1.5 rounded-lg font-500 transition-colors ${
                              isSelected
                                ? "bg-[#3730A3] text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-[#3730A3]/10"
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            onClick={handleBuchen}
            disabled={!selectedSlot || isPending || loadingSlots}
            className="w-full"
          >
            {isPending && !loadingSlots ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Buchen…
              </>
            ) : selectedSlot ? (
              `Buchen – ${new Date(selectedSlot.beginn).toLocaleDateString(
                "de-CH",
                { weekday: "short", day: "numeric", month: "short" }
              )} ${new Date(selectedSlot.beginn).toLocaleTimeString("de-CH", {
                hour: "2-digit",
                minute: "2-digit",
              })} Uhr`
            ) : (
              "Zeitfenster wählen"
            )}
          </Button>
        </div>
      )}
    </div>
  );
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

function getDaysInWeek(weekOffset: number): DayInfo[] {
  const monday = getMonday(weekOffset);
  const days: DayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * 86400000);
    days.push({
      dateStr: d.toISOString().split("T")[0],
      label: d.toLocaleDateString("de-CH", { weekday: "short" }),
    });
  }
  return days;
}

function groupSlotsByDay(slots: AvailableSlot[]): Map<string, AvailableSlot[]> {
  const map = new Map<string, AvailableSlot[]>();
  for (const slot of slots) {
    const dateStr = slot.beginn.split("T")[0];
    if (!map.has(dateStr)) map.set(dateStr, []);
    map.get(dateStr)!.push(slot);
  }
  return map;
}
