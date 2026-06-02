"use client";

import { useState, useEffect, useTransition } from "react";
import { updateVerfuegbarkeit, type VerfuegbarkeitSlot } from "../actions";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DAYS = [
  { label: "Montag", wochentag: 1 },
  { label: "Dienstag", wochentag: 2 },
  { label: "Mittwoch", wochentag: 3 },
  { label: "Donnerstag", wochentag: 4 },
  { label: "Freitag", wochentag: 5 },
  { label: "Samstag", wochentag: 6 },
];

type SlotState = {
  aktiv: boolean;
  beginn_zeit: string;
  ende_zeit: string;
};

const DEFAULT_SLOT: SlotState = {
  aktiv: false,
  beginn_zeit: "14:00",
  ende_zeit: "18:00",
};

export default function VerfuegbarkeitPage() {
  const [slots, setSlots] = useState<Record<number, SlotState>>(
    Object.fromEntries(DAYS.map((d) => [d.wochentag, { ...DEFAULT_SLOT }]))
  );
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("admin_verfuegbarkeit")
      .select("*")
      .then(({ data }) => {
        if (data && data.length > 0) {
          const map: Record<number, SlotState> = Object.fromEntries(
            DAYS.map((d) => [d.wochentag, { ...DEFAULT_SLOT }])
          );
          for (const row of data) {
            map[row.wochentag] = {
              aktiv: row.aktiv,
              beginn_zeit: row.beginn_zeit.slice(0, 5),
              ende_zeit: row.ende_zeit.slice(0, 5),
            };
          }
          setSlots(map);
        }
        setLoading(false);
      });
  }, []);

  function update(wochentag: number, field: keyof SlotState, value: string | boolean) {
    setSlots((prev) => ({
      ...prev,
      [wochentag]: { ...prev[wochentag], [field]: value },
    }));
    setSuccess(false);
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    const payload: VerfuegbarkeitSlot[] = DAYS.map((d) => ({
      wochentag: d.wochentag,
      beginn_zeit: slots[d.wochentag].beginn_zeit,
      ende_zeit: slots[d.wochentag].ende_zeit,
      aktiv: slots[d.wochentag].aktiv,
    }));
    startTransition(async () => {
      const result = await updateVerfuegbarkeit(payload);
      if (result?.error) setError(result.error);
      else setSuccess(true);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-6 h-6 animate-spin text-[#1C244B]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-800 text-[#1C244B]">Verfügbarkeit</h1>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <p className="text-sm text-gray-500">
          Lege fest, an welchen Tagen und zu welchen Zeiten Schüler Lektionen
          buchen können. Zeitfenster werden in 60-Minuten-Slots aufgeteilt.
        </p>

        <div className="space-y-3">
          {DAYS.map(({ label, wochentag }) => {
            const slot = slots[wochentag];
            return (
              <div
                key={wochentag}
                className={`rounded-xl border transition-colors p-4 ${
                  slot.aktiv
                    ? "border-[#1C244B]/30 bg-[#1C244B]/5"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2.5 cursor-pointer min-w-[120px]">
                    <input
                      type="checkbox"
                      checked={slot.aktiv}
                      onChange={(e) =>
                        update(wochentag, "aktiv", e.target.checked)
                      }
                      className="w-4 h-4 accent-[#1C244B] cursor-pointer"
                    />
                    <span
                      className={`text-sm font-600 ${
                        slot.aktiv ? "text-[#1C244B]" : "text-gray-500"
                      }`}
                    >
                      {label}
                    </span>
                  </label>

                  <div
                    className={`flex items-center gap-3 flex-1 transition-opacity ${
                      slot.aktiv ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Von</label>
                      <input
                        type="time"
                        value={slot.beginn_zeit}
                        onChange={(e) =>
                          update(wochentag, "beginn_zeit", e.target.value)
                        }
                        disabled={!slot.aktiv}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1C244B]/30 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Bis</label>
                      <input
                        type="time"
                        value={slot.ende_zeit}
                        onChange={(e) =>
                          update(wochentag, "ende_zeit", e.target.value)
                        }
                        disabled={!slot.aktiv}
                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1C244B]/30 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {success && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4" />
            Verfügbarkeit gespeichert!
          </div>
        )}

        <Button onClick={handleSave} disabled={isPending} className="w-full sm:w-auto">
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Speichern…
            </>
          ) : (
            "Verfügbarkeit speichern"
          )}
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-3">
          Ausnahmen & Ferien
        </h2>
        <p className="text-sm text-gray-500">
          Für individuelle Ausnahmen und Ferienabwesenheiten bitte direkt
          Termine als storniert markieren oder Schüler kontaktieren.
        </p>
      </div>
    </div>
  );
}
