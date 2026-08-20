"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarSync,
  Check,
  Info,
  Loader2,
  RefreshCw,
  Unlink,
} from "lucide-react";
import {
  appleKalenderAbgleichen,
  appleKalenderSetzen,
  appleKalenderTrennen,
} from "@/app/admin/actions";


/**
 * Apple-Kalender als Sperrzeit.
 *
 * Nur lesend: Was David privat einträgt, blockiert hier Termine. Umgekehrt
 * wird nichts in seinen Kalender geschrieben — dafür gibt es den bestehenden
 * Google-Sync.
 */
export default function AppleKalender({
  vorhanden,
  url,
  titelUebernehmen,
  zuletzt,
  fehler,
  anzahl,
}: {
  vorhanden: boolean;
  url: string;
  titelUebernehmen: boolean;
  zuletzt: string | null;
  fehler: string | null;
  anzahl: number | null;
}) {
  const router = useRouter();
  const [wert, setWert] = useState(url);
  const [titel, setTitel] = useState(titelUebernehmen);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function speichern() {
    setMeldung(null);
    setProblem(null);
    starte(async () => {
      const res = await appleKalenderSetzen(wert, titel);
      if ("error" in res && res.error) {
        setProblem(res.error);
        return;
      }
      if ("termine" in res) {
        setMeldung(
          `${res.termine} Termine gelesen, ${res.bloecke} Sperrzeiten gesetzt.`
        );
      }
      router.refresh();
    });
  }

  function abgleichen() {
    setMeldung(null);
    setProblem(null);
    starte(async () => {
      const res = await appleKalenderAbgleichen();
      if ("error" in res && res.error) {
        setProblem(res.error);
        return;
      }
      if ("termine" in res) {
        setMeldung(
          `${res.termine} Termine gelesen, ${res.bloecke} Sperrzeiten gesetzt.`
        );
      }
      router.refresh();
    });
  }

  function trennen() {
    if (
      !confirm(
        "Kalender abmelden?\n\nDie importierten Sperrzeiten werden entfernt. Deine von Hand angelegten Zeitblöcke bleiben."
      )
    ) {
      return;
    }
    starte(async () => {
      const res = await appleKalenderTrennen();
      if ("entfernt" in res) {
        setMeldung(`Abgemeldet, ${res.entfernt} Sperrzeiten entfernt.`);
        setWert("");
      }
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <CalendarSync className="w-4 h-4 text-[#1C244B]" />
          <h2 className="font-700 text-[#1C244B]">Apple-Kalender sperren</h2>
          {vorhanden && !fehler && (
            <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              aktiv
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 leading-snug mt-1">
          Termine aus deinem privaten Kalender blockieren hier automatisch die
          Zeit. Es wird nur gelesen — in deinen Kalender schreibt das System
          nichts.
        </p>
      </div>

      <div className="rounded-xl bg-[#F3F5F8] border border-[#E3E7EE] p-3.5 flex gap-2.5">
        <Info className="w-4 h-4 text-[#1C244B] flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600 leading-snug space-y-1.5">
          <p className="font-600 text-[#1C244B]">So kommst du an den Link</p>
          <p>
            Kalender-App öffnen, mit der rechten Maustaste auf den Kalender,{" "}
            <strong>Kalender freigeben</strong> → <strong>Öffentlicher Kalender</strong>{" "}
            ankreuzen → Link kopieren. Am Mac und auf dem iPhone gleich.
          </p>
          <p className="text-gray-500">
            Der Link ist eine lange Zufalls-ID. Wer ihn hat, kann die Termine
            lesen — teile ihn also nicht. Falls dir das zu weit geht, lass
            unten den Titel weg: Dann steht hier nur &bdquo;Privat&ldquo;,
            gesperrt wird trotzdem.
          </p>
        </div>
      </div>

      <label className="space-y-1.5 block">
        <span className="text-sm font-600 text-gray-700">iCal-Link</span>
        <input
          value={wert}
          onChange={(e) => setWert(e.target.value)}
          placeholder="webcal://p01-calendars.icloud.com/published/…"
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#1C244B]"
        />
      </label>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={titel}
          onChange={(e) => setTitel(e.target.checked)}
          className="w-4 h-4 accent-[#1C244B] mt-0.5"
        />
        <span className="text-sm text-gray-600 leading-snug">
          Termintitel übernehmen. Ohne Haken heisst jede Sperre
          &bdquo;Privat&ldquo; — für die Blockierung macht es keinen
          Unterschied.
        </span>
      </label>

      {problem && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2.5">
          {problem}
        </p>
      )}
      {meldung && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3.5 py-2.5 inline-flex items-center gap-2">
          <Check className="w-4 h-4" />
          {meldung}
        </p>
      )}
      {fehler && !problem && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
          Letzter Abruf fehlgeschlagen: {fehler}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={speichern}
          disabled={laeuft || !wert.trim()}
          className="text-sm font-600 px-4 py-2.5 rounded-xl bg-[#1C244B] text-white disabled:opacity-40 inline-flex items-center gap-2"
        >
          {laeuft && <Loader2 className="w-4 h-4 animate-spin" />}
          {vorhanden ? "Speichern und einlesen" : "Verbinden"}
        </button>
        {vorhanden && (
          <>
            <button
              onClick={abgleichen}
              disabled={laeuft}
              className="text-sm font-600 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Jetzt einlesen
            </button>
            <button
              onClick={trennen}
              disabled={laeuft}
              className="text-sm font-600 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-red-600 disabled:opacity-40 inline-flex items-center gap-2"
            >
              <Unlink className="w-4 h-4" />
              Abmelden
            </button>
          </>
        )}
      </div>

      {vorhanden && zuletzt && (
        <p className="text-xs text-gray-400">
          Zuletzt eingelesen:{" "}
          {new Date(zuletzt).toLocaleString("de-CH", {
            timeZone: "Europe/Zurich",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {anzahl != null && ` · ${anzahl} Sperrzeiten`}. Der Abgleich läuft
          täglich automatisch.
        </p>
      )}
    </div>
  );
}
