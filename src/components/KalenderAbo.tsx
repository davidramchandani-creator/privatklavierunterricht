"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, Check, Copy, Loader2, RotateCcw, Smartphone } from "lucide-react";

/**
 * „In Kalender abonnieren", für Schüler und für David dieselbe Komponente.
 *
 * Zwei Wege, weil die Geräte verschieden sind:
 *
 *   webcal://   Auf iPhone, Mac und in Outlook öffnet der Link direkt den
 *               Dialog „Kalender abonnieren". Ein Tipp, fertig.
 *   Link kopieren   Google Kalender kennt webcal nicht; dort fügt man die
 *               Adresse unter „Weitere Kalender → Per URL" ein. Android
 *               ebenso.
 *
 * Der Link wird erst geholt, wenn jemand den Knopf drückt: Ein Token, den
 * nie jemand abruft, ist ein Schlüssel, der nur herumliegt.
 */
export default function KalenderAbo({
  holeLink,
  setzeZurueck,
  titel = "Termine im Handy-Kalender",
  hinweis = "Deine Lektionen erscheinen im Kalender deines Handys und aktualisieren sich von selbst, auch bei Verschiebungen.",
}: {
  /** Liefert die https-Adresse des Feeds. */
  holeLink: () => Promise<{ url: string } | { error: string }>;
  /** Neuer Link, der alte hört auf zu funktionieren. */
  setzeZurueck?: () => Promise<{ url: string } | { error: string }>;
  titel?: string;
  hinweis?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [laeuft, starte] = useTransition();

  const webcal = url ? url.replace(/^https?:\/\//, "webcal://") : null;

  function anzeigen() {
    setFehler(null);
    starte(async () => {
      const r = await holeLink();
      if ("error" in r) {
        setFehler(r.error);
        return;
      }
      setUrl(r.url);
    });
  }

  function zuruecksetzen() {
    if (!setzeZurueck) return;
    if (
      !window.confirm(
        "Neuen Link erzeugen? Der bisherige funktioniert danach nicht mehr, auch auf Geräten, die ihn schon abonniert haben."
      )
    ) {
      return;
    }
    setFehler(null);
    starte(async () => {
      const r = await setzeZurueck();
      if ("error" in r) {
        setFehler(r.error);
        return;
      }
      setUrl(r.url);
    });
  }

  async function kopieren() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      setFehler("Kopieren ging nicht. Markiere die Adresse und kopiere sie von Hand.");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarPlus className="w-4 h-4 text-[#1C244B]" />
        <p className="font-600 text-[#1C244B]">{titel}</p>
      </div>
      <p className="text-sm text-gray-500 leading-snug">{hinweis}</p>

      {!url ? (
        <button
          onClick={anzeigen}
          disabled={laeuft}
          className="press inline-flex items-center gap-2 text-sm font-600 px-4 py-2.5 rounded-xl bg-[#1C244B] text-white hover:bg-[#2A3563] disabled:opacity-40"
        >
          {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
          In Kalender abonnieren
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={webcal ?? "#"}
              className="press inline-flex items-center justify-center gap-2 text-sm font-600 px-4 py-2.5 rounded-xl bg-[#1C244B] text-white hover:bg-[#2A3563]"
            >
              <Smartphone className="w-4 h-4" />
              iPhone, Mac oder Outlook
            </a>
            <button
              onClick={kopieren}
              className="press inline-flex items-center justify-center gap-2 text-sm font-600 px-4 py-2.5 rounded-xl border border-gray-200 text-[#1C244B] hover:bg-gray-50"
            >
              {kopiert ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {kopiert ? "Kopiert" : "Link kopieren (Google, Android)"}
            </button>
          </div>

          <div className="rounded-xl bg-[#F3F5F8] px-3.5 py-2.5">
            <p className="text-[11px] font-600 text-gray-400 uppercase tracking-wide mb-1">
              Adresse
            </p>
            <p className="text-xs text-gray-700 break-all font-mono select-all">{url}</p>
          </div>

          <p className="text-xs text-gray-400 leading-snug">
            Google Kalender: links unter Weitere Kalender auf das Plus, dann
            Per URL, Adresse einfügen. Wer den Link hat, sieht den Kalender.
            Gib ihn nicht weiter.
          </p>

          {setzeZurueck && (
            <button
              onClick={zuruecksetzen}
              disabled={laeuft}
              className="inline-flex items-center gap-1.5 text-xs font-600 text-gray-400 hover:text-red-600 disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3" />
              Link zurücksetzen
            </button>
          )}
        </div>
      )}

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
    </div>
  );
}
