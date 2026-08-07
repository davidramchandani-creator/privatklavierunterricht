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

/** Gilt für alle Blöcke gemeinsam – eine Lektionsdauer pro Betrieb. */
type BlockConfigState = {
  lesson_minutes: number;
  min_buffer_minutes: number;
  packing: "lueckenlos" | "maximal";
};

const DEFAULT_CONFIG: BlockConfigState = {
  lesson_minutes: 45,
  min_buffer_minutes: 15,
  packing: "lueckenlos",
};

export default function VerfuegbarkeitPage() {
  const [slots, setSlots] = useState<Record<number, SlotState>>(
    Object.fromEntries(DAYS.map((d) => [d.wochentag, { ...DEFAULT_SLOT }]))
  );
  const [config, setConfig] = useState<BlockConfigState>(DEFAULT_CONFIG);
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
          const erste = data.find((r) => r.aktiv) ?? data[0];
          if (erste) {
            setConfig({
              lesson_minutes: erste.lesson_minutes ?? DEFAULT_CONFIG.lesson_minutes,
              min_buffer_minutes:
                erste.min_buffer_minutes ?? DEFAULT_CONFIG.min_buffer_minutes,
              packing: erste.packing === "maximal" ? "maximal" : "lueckenlos",
            });
          }
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
      lesson_minutes: config.lesson_minutes,
      min_buffer_minutes: config.min_buffer_minutes,
      packing: config.packing,
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

      {/* Lektionsdauer, Puffer, Belegungsstrategie */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="font-700 text-[#1C244B]">Lektion &amp; Puffer</h2>
          <p className="text-sm text-gray-500 mt-1">
            Gilt für alle Tage. Der Puffer ist die Untergrenze – wohnt ein
            Schüler weiter weg, wird automatisch dessen Fahrzeit verwendet
            (aufgerundet auf 15 Minuten).
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="space-y-1.5 block">
            <span className="text-sm font-600 text-gray-700">Lektionsdauer</span>
            <select
              value={config.lesson_minutes}
              onChange={(e) => {
                setConfig((c) => ({ ...c, lesson_minutes: Number(e.target.value) }));
                setSuccess(false);
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
            >
              {[30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} Minuten
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 block">
            <span className="text-sm font-600 text-gray-700">Mindestpuffer</span>
            <select
              value={config.min_buffer_minutes}
              onChange={(e) => {
                setConfig((c) => ({
                  ...c,
                  min_buffer_minutes: Number(e.target.value),
                }));
                setSuccess(false);
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
            >
              {[0, 15, 30, 45].map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "kein Puffer" : `${m} Minuten`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-600 text-gray-700">Terminvergabe</span>
          {(
            [
              {
                wert: "lueckenlos" as const,
                titel: "Lückenlos",
                text: "Lektionen reihen sich bündig aneinander. Weniger Auswahl, dafür keine ungenutzten Löcher.",
              },
              {
                wert: "maximal" as const,
                titel: "Maximale Auswahl",
                text: "Mehr Startzeiten für Schüler. Kleine unbrauchbare Löcher sind möglich.",
              },
            ]
          ).map(({ wert, titel, text }) => (
            <label
              key={wert}
              className={`flex gap-3 items-start rounded-xl border p-3 cursor-pointer transition-colors ${
                config.packing === wert
                  ? "border-[#1C244B]/40 bg-[#1C244B]/5"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="packing"
                checked={config.packing === wert}
                onChange={() => {
                  setConfig((c) => ({ ...c, packing: wert }));
                  setSuccess(false);
                }}
                className="mt-0.5 w-4 h-4 accent-[#1C244B]"
              />
              <span>
                <span className="block text-sm font-600 text-[#1C244B]">{titel}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{text}</span>
              </span>
            </label>
          ))}
        </div>

        <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
          Beispiel: Block 16:00–20:30 mit {config.lesson_minutes} Min. Lektion und{" "}
          {config.min_buffer_minutes} Min. Puffer ergibt{" "}
          <strong>
            {Math.floor(
              (270 + config.min_buffer_minutes) /
                (config.lesson_minutes + config.min_buffer_minutes)
            )}{" "}
            Lektionen
          </strong>{" "}
          pro Abend.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <p className="text-sm text-gray-500">
          Lege fest, an welchen Tagen und zu welchen Zeiten Schüler Lektionen
          buchen können.
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

      <div className="bg-[#1C244B]/5 rounded-2xl border border-[#1C244B]/10 p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-2">
          Abwesenheiten & Ferien
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Diese Verfügbarkeit ist dein wöchentlicher Standard-Rhythmus.{" "}
          <span className="font-600 text-[#1C244B]">Abwesenheiten überschreiben die Verfügbarkeit</span>{" "}
          – an Tagen, die du unter{" "}
          <a href="/admin/abwesenheiten" className="underline font-600 text-[#1C244B] hover:opacity-80">
            Abwesenheiten
          </a>{" "}
          einträgst, sind keine Buchungen möglich, auch wenn der Wochentag hier
          aktiv ist. Für einzelne gesperrte Zeitfenster nutze die Zeitblöcke.
        </p>
      </div>
    </div>
  );
}
