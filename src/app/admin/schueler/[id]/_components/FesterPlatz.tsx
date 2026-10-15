"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";
import { WEEKDAY_LABELS } from "@/lib/fixplatz";
import { festenPlatzAendern } from "../platz-actions";

/**
 * Den festen Platz eines laufenden Abos direkt ändern.
 *
 * Hier lässt sich auch einstellen: jede Woche am selben Tag, aber in
 * ungeraden Wochen zu einer anderen Uhrzeit. Die künftigen Serientermine
 * werden ersetzt, was schon war, bleibt. Erst wenn alle Termine Platz
 * haben, wird etwas geändert.
 */
const TAGE = [1, 2, 3, 4, 5, 6, 0];

export default function FesterPlatz({
  studentId,
  rhythmus,
  jetzt,
}: {
  studentId: string;
  rhythmus: "woechentlich" | "zweiwoechentlich";
  jetzt: {
    wochentag: number | null;
    beginn: string | null;
    paritaet: 0 | 1 | null;
    beginnUngerade: string | null;
    text: string | null;
  };
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [wochentag, setWochentag] = useState(String(jetzt.wochentag ?? 1));
  const [beginn, setBeginn] = useState(jetzt.beginn?.slice(0, 5) ?? "");
  const [paritaet, setParitaet] = useState(String(jetzt.paritaet ?? 0));
  const [ungerade, setUngerade] = useState(jetzt.beginnUngerade?.slice(0, 5) ?? "");
  const [mitMail, setMitMail] = useState(true);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [laeuft, starte] = useTransition();

  function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (
      !window.confirm(
        "Künftige Termine werden durch den neuen Platz ersetzt. Weiter?"
      )
    ) {
      return;
    }
    setMeldung(null);
    starte(async () => {
      const r = await festenPlatzAendern(
        studentId,
        {
          wochentag: Number(wochentag),
          beginn,
          paritaet: rhythmus === "zweiwoechentlich" ? (Number(paritaet) as 0 | 1) : null,
          beginnUngerade: rhythmus === "woechentlich" && ungerade ? ungerade : null,
        },
        mitMail
      );
      if ("error" in r && r.error) {
        setMeldung({ text: r.error, fehler: true });
        return;
      }
      if (!("termine" in r)) return;
      setMeldung({
        text: `Gespeichert, ${r.termine} Termine gebucht.${r.mail ? " Bestätigung ist raus." : ""}`,
        fehler: false,
      });
      setOffen(false);
      router.refresh();
    });
  }

  const feld = "rounded-lg border border-gray-200 px-2.5 py-2 text-sm bg-white";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-700 text-[#1C244B] flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            Fester Platz
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {jetzt.text ?? "Noch kein fester Platz."}
          </p>
        </div>
        {!offen && (
          <button
            onClick={() => setOffen(true)}
            className="press text-sm font-600 px-3 py-2 rounded-xl border border-gray-200 text-[#1C244B] hover:bg-gray-50"
          >
            Ändern
          </button>
        )}
      </div>

      {offen && (
        <form onSubmit={speichern} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <select value={wochentag} onChange={(e) => setWochentag(e.target.value)} className={feld}>
              {TAGE.map((t) => (
                <option key={t} value={t}>
                  {WEEKDAY_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              type="time"
              step={900}
              value={beginn}
              onChange={(e) => setBeginn(e.target.value)}
              className={`${feld} tabular-nums`}
              required
            />
            {rhythmus === "zweiwoechentlich" && (
              <select value={paritaet} onChange={(e) => setParitaet(e.target.value)} className={feld}>
                <option value="0">gerade Wochen</option>
                <option value="1">ungerade Wochen</option>
              </select>
            )}
          </div>

          {rhythmus === "woechentlich" && (
            <label className="block space-y-1 max-w-sm">
              <span className="text-xs font-600 text-gray-600">
                Ungerade Wochen andere Uhrzeit (optional)
              </span>
              <input
                type="time"
                step={900}
                value={ungerade}
                onChange={(e) => setUngerade(e.target.value)}
                className={`${feld} w-full tabular-nums`}
              />
              <span className="block text-[11px] text-gray-400 leading-snug">
                Leer lassen, wenn jede Woche dieselbe Zeit gilt. Sonst gilt die Zeit
                oben in geraden Wochen, diese in ungeraden.
              </span>
            </label>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={mitMail}
              onChange={(e) => setMitMail(e.target.checked)}
              className="w-4 h-4 accent-[#1C244B]"
            />
            Bestätigung mit neuer Terminliste schicken
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={laeuft || !beginn}
              className="press inline-flex items-center gap-2 text-sm font-600 px-4 py-2 rounded-xl bg-[#1C244B] text-white hover:bg-[#2A3563] disabled:opacity-40"
            >
              {laeuft && <Loader2 className="w-4 h-4 animate-spin" />}
              Speichern
            </button>
            <button
              type="button"
              onClick={() => setOffen(false)}
              className="text-sm font-600 px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-100"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {meldung && (
        <p className={`mt-3 text-sm ${meldung.fehler ? "text-red-600" : "text-emerald-700"}`}>
          {meldung.text}
        </p>
      )}
    </div>
  );
}
