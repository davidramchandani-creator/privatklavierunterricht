"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buchTermin } from "../actions";

const SLOT_DURATION = 60; // minutes

type Slot = {
  beginn: string;
  ende: string;
};

export default function TerminBuchen({
  schueler_id,
  paket_id,
}: {
  schueler_id: string;
  paket_id: string;
}) {
  const [open, setOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Minimal demo: show Mon–Fri, 14:00–18:00 as available slots
  // In production, fetch available slots from admin_verfuegbarkeit filtered against booked termine
  const weekStart = getMonday(weekOffset);
  const slots = generateDemoSlots(weekStart);

  const weekLabel = `${weekStart.toLocaleDateString("de-CH", { day: "numeric", month: "long" })} – ${
    new Date(weekStart.getTime() + 4 * 86400000).toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" })
  }`;

  async function handleBuchen() {
    if (!selectedSlot) return;
    setError(null);
    startTransition(async () => {
      const result = await buchTermin(schueler_id, paket_id, selectedSlot.beginn, selectedSlot.ende);
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
            <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Abbrechen</button>
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
          <div className="grid grid-cols-5 gap-2">
            {slots.map((daySlots, di) => {
              const dayDate = new Date(weekStart.getTime() + di * 86400000);
              return (
                <div key={di} className="space-y-1.5">
                  <p className="text-[10px] font-600 text-gray-400 text-center uppercase tracking-wide">
                    {dayDate.toLocaleDateString("de-CH", { weekday: "short" })}
                  </p>
                  {daySlots.map((slot) => {
                    const isSelected = selectedSlot?.beginn === slot.beginn;
                    const time = new Date(slot.beginn).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <button
                        key={slot.beginn}
                        onClick={() => setSelectedSlot(isSelected ? null : slot)}
                        className={`w-full text-xs py-1.5 rounded-lg font-500 transition-colors ${
                          isSelected
                            ? "bg-[#3730A3] text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-[#3730A3]/10"
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <Button
            onClick={handleBuchen}
            disabled={!selectedSlot || isPending}
            className="w-full"
          >
            {isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Buchen…</>
            ) : selectedSlot ? (
              `Buchen – ${new Date(selectedSlot.beginn).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })} ${new Date(selectedSlot.beginn).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })} Uhr`
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

function generateDemoSlots(weekStart: Date): Slot[][] {
  const result: Slot[][] = [];
  const now = new Date();
  for (let d = 0; d < 5; d++) {
    const daySlots: Slot[] = [];
    for (let h = 14; h < 18; h++) {
      const beginn = new Date(weekStart.getTime() + d * 86400000);
      beginn.setHours(h, 0, 0, 0);
      if (beginn <= now) continue;
      const ende = new Date(beginn.getTime() + SLOT_DURATION * 60000);
      daySlots.push({ beginn: beginn.toISOString(), ende: ende.toISOString() });
    }
    result.push(daySlots);
  }
  return result;
}
