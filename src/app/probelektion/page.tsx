"use client";

import { useState, useTransition, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle2,
  Loader2,
  Music,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPublicSlots, submitAnfrage, type PublicSlot } from "./actions";

export default function ProbelektionPage() {
  const [step, setStep] = useState<"slots" | "form" | "done">("slots");
  const [weekOffset, setWeekOffset] = useState(0);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    startTransition(async () => {
      const result = await getPublicSlots(weekOffset);
      setSlots(result);
      setLoadingSlots(false);
    });
  }, [weekOffset]);

  const slotsByDay = groupByDay(slots);
  const days = getDaysInWeek(weekOffset);
  const monday = getMonday(weekOffset);
  const friday = new Date(monday.getTime() + 4 * 86400000);
  const weekLabel = `${monday.toLocaleDateString("de-CH", { day: "numeric", month: "long" })} – ${friday.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric" })}`;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    if (selectedSlot) formData.set("wunschtermin", selectedSlot.beginn);
    startTransition(async () => {
      const result = await submitAnfrage(formData);
      if (result?.error) setError(result.error);
      else setStep("done");
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#1C244B]">
            <span className="w-8 h-8 rounded-lg bg-[#1C244B] flex items-center justify-center">
              <Music className="w-4 h-4 text-white" />
            </span>
            <span className="font-700 text-base hidden sm:block">David</span>
          </Link>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            ← Zurück zur Startseite
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {step === "done" ? (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-10 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-800 text-gray-900">Anfrage gesendet!</h1>
            <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
              Ich melde mich so schnell wie möglich bei dir. Meist antworte
              ich innerhalb von 24 Stunden.
            </p>
            {selectedSlot && (
              <p className="text-sm text-[#1C244B] font-600 bg-indigo-50 rounded-xl px-4 py-2 inline-block">
                Wunschtermin:{" "}
                {new Date(selectedSlot.beginn).toLocaleDateString("de-CH", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}{" "}
                um{" "}
                {new Date(selectedSlot.beginn).toLocaleTimeString("de-CH", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                Uhr
              </p>
            )}
            <Link href="/">
              <Button variant="outline" className="mt-4">Zurück zur Startseite</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Title */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 mb-2">
                <span className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse" />
                <span className="text-[#1C244B] text-sm font-600">Kostenlos & unverbindlich</span>
              </div>
              <h1 className="text-3xl font-800 text-gray-900">Probelektion buchen</h1>
              <p className="text-gray-500 max-w-lg mx-auto">
                Wähle einen Wunschtermin und hinterlasse deine Kontaktdaten.
                Ich bestätige die Anfrage persönlich.
              </p>
            </div>

            {/* Slot picker */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h2 className="font-700 text-[#1C244B]">
                {selectedSlot ? "✓ Wunschtermin gewählt" : "Wunschtermin wählen"}
                <span className="text-gray-400 font-400 text-sm ml-2">(optional)</span>
              </h2>

              {/* Week navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setWeekOffset((w) => w - 1)}
                  disabled={weekOffset <= 0}
                  className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-500 text-gray-600">{weekLabel}</span>
                <button
                  onClick={() => setWeekOffset((w) => w + 1)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {loadingSlots ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-[#1C244B]" />
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Calendar className="w-7 h-7 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Keine freien Termine diese Woche</p>
                  <p className="text-xs mt-1">Nächste Woche versuchen →</p>
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {days.slice(0, 5).map((d) => {
                    const daySlots = slotsByDay.get(d.dateStr) ?? [];
                    return (
                      <div key={d.dateStr} className="space-y-1.5">
                        <p className="text-[10px] font-600 text-gray-400 text-center uppercase tracking-wide">
                          {d.label}
                        </p>
                        <p className="text-[10px] text-gray-500 text-center">
                          {new Date(d.dateStr).toLocaleDateString("de-CH", { day: "numeric", month: "numeric" })}
                        </p>
                        {daySlots.length === 0 ? (
                          <p className="text-[10px] text-gray-200 text-center mt-2">—</p>
                        ) : (
                          daySlots.map((slot) => {
                            const isSelected = selectedSlot?.beginn === slot.beginn;
                            const time = new Date(slot.beginn).toLocaleTimeString("de-CH", {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                            return (
                              <button
                                key={slot.beginn}
                                onClick={() => setSelectedSlot(isSelected ? null : slot)}
                                className={`w-full text-xs py-1.5 rounded-lg font-500 transition-colors ${
                                  isSelected
                                    ? "bg-[#1C244B] text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-[#1C244B]/10"
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

              {selectedSlot && (
                <p className="text-xs text-[#1C244B] bg-indigo-50 rounded-xl px-3 py-2 font-500">
                  Gewählt:{" "}
                  {new Date(selectedSlot.beginn).toLocaleDateString("de-CH", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}{" "}
                  um{" "}
                  {new Date(selectedSlot.beginn).toLocaleTimeString("de-CH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  Uhr
                </p>
              )}
            </div>

            {/* Contact form */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-700 text-[#1C244B] mb-5">Deine Kontaktdaten</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-500 text-gray-700">Vorname *</label>
                    <input
                      name="vorname"
                      required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C244B]/30 focus:border-[#1C244B]"
                      placeholder="Anna"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-500 text-gray-700">Nachname *</label>
                    <input
                      name="nachname"
                      required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C244B]/30 focus:border-[#1C244B]"
                      placeholder="Müller"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-500 text-gray-700">E-Mail *</label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C244B]/30 focus:border-[#1C244B]"
                    placeholder="anna@beispiel.ch"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-500 text-gray-700">Telefon</label>
                  <input
                    name="telefon"
                    type="tel"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C244B]/30 focus:border-[#1C244B]"
                    placeholder="+41 79 123 45 67"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-500 text-gray-700">Nachricht</label>
                  <textarea
                    name="nachricht"
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C244B]/30 focus:border-[#1C244B] resize-none"
                    placeholder="Erfahrung, Ziele, besondere Wünsche…"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
                )}

                <Button type="submit" disabled={isPending} size="lg" className="w-full">
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Senden…
                    </>
                  ) : (
                    "Anfrage senden"
                  )}
                </Button>

                <p className="text-xs text-gray-400 text-center">
                  Keine Verpflichtung. Ich melde mich innerhalb von 24 Stunden.
                </p>
              </form>
            </div>
          </>
        )}
      </main>
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

function getDaysInWeek(weekOffset: number) {
  const monday = getMonday(weekOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * 86400000);
    return {
      dateStr: d.toISOString().split("T")[0],
      label: d.toLocaleDateString("de-CH", { weekday: "short" }),
    };
  });
}

function groupByDay(slots: PublicSlot[]): Map<string, PublicSlot[]> {
  const map = new Map<string, PublicSlot[]>();
  for (const slot of slots) {
    const key = slot.beginn.split("T")[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(slot);
  }
  return map;
}
