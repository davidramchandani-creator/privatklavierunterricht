"use client";

import { useState, useTransition, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import {
  getMonday,
  getDaysInWeek,
  weekLabel as buildWeekLabel,
  groupSlotsByDay,
  fmtTime,
} from "./week-grid-utils";
import { getGroupSlots } from "../actions";
import type { AvailableSlot } from "../actions";

export default function GruppenSlotPicker({
  courseId,
  priceHint,
  onSelect,
  onClose,
}: {
  courseId: string;
  priceHint: string;
  onSelect: (slot: AvailableSlot) => void;
  onClose: () => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AvailableSlot | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    startTransition(async () => {
      const result = await getGroupSlots(courseId, weekOffset);
      setSlots(result);
      setLoading(false);
    });
  }, [courseId, weekOffset]);

  const slotsByDay = groupSlotsByDay(slots);
  const displayDays = getDaysInWeek(weekOffset);
  const label = buildWeekLabel(weekOffset);

  return (
    <div className="space-y-3 mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-600 text-gray-700">Startzeit für neue Session wählen</p>
        <button onClick={onClose} className="text-[11px] text-gray-400 hover:text-gray-600">
          Abbrechen
        </button>
      </div>

      {priceHint && (
        <p className="text-[11px] text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg">
          {priceHint}
        </p>
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
        <span className="text-xs font-500 text-gray-600">{label}</span>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loading || isPending ? (
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
          {/* Mobile */}
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
                      const isSel = selected?.beginn === slot.beginn;
                      return (
                        <button
                          key={slot.beginn}
                          onClick={() => setSelected(isSel ? null : slot)}
                          className={`relative text-sm py-2.5 px-3 rounded-xl font-500 transition-colors ${
                            isSel
                              ? "bg-[#1C244B] text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-[#1C244B]/10"
                          }`}
                        >
                          {isSel && (
                            <CheckCircle2 className="w-2.5 h-2.5 absolute top-1 right-1 text-emerald-300" />
                          )}
                          {fmtTime(slot.beginn)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop */}
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
                      const isSel = selected?.beginn === slot.beginn;
                      return (
                        <button
                          key={slot.beginn}
                          onClick={() => setSelected(isSel ? null : slot)}
                          className={`w-full text-xs py-1.5 rounded-lg font-500 transition-colors relative ${
                            isSel
                              ? "bg-[#1C244B] text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-[#1C244B]/10"
                          }`}
                        >
                          {isSel && (
                            <CheckCircle2 className="w-2.5 h-2.5 absolute top-1 right-1 text-emerald-300" />
                          )}
                          {fmtTime(slot.beginn)}
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

      <button
        onClick={() => selected && onSelect(selected)}
        disabled={!selected}
        className="w-full text-sm font-600 text-white bg-[#1C244B] rounded-xl py-2.5 hover:bg-[#151c3d] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0"
      >
        {selected
          ? `Session erstellen – ${new Date(selected.beginn).toLocaleDateString("de-CH", {
              timeZone: "Europe/Zurich",
              weekday: "short",
              day: "numeric",
              month: "short",
            })} ${fmtTime(selected.beginn)} Uhr`
          : "Zeitfenster wählen"}
      </button>
    </div>
  );
}
