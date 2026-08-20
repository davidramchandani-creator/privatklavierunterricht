"use client";

import { useState, useTransition } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import { startpunktSetzen } from "@/app/admin/actions";

/**
 * Von wo dieser Abend startet.
 *
 * Für Tage mit Hochschule oder Arbeit anderswo: David kommt dann nicht von
 * zuhause, und der Routenplaner soll die erste Fahrt von dort rechnen. Ein
 * Schüler in Winterthur ist von Zürich HB aus fast auf dem Weg, von
 * Neftenbach aus ein Umweg — ohne diese Angabe ordnet der Planer den ganzen
 * Abend falsch.
 */
export default function Startpunkt({
  wochentag,
  adresse,
  onGespeichert,
}: {
  wochentag: number;
  adresse: string | null;
  onGespeichert: (adresse: string | null) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [wert, setWert] = useState(adresse ?? "");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function speichern(neu: string) {
    setFehler(null);
    starte(async () => {
      const res = await startpunktSetzen(wochentag, neu);
      if ("error" in res && res.error) {
        setFehler(res.error);
        return;
      }
      if ("adresse" in res) {
        onGespeichert(res.adresse);
        setWert(res.adresse ?? "");
      }
      setOffen(false);
    });
  }

  if (!offen) {
    return (
      <div className="mt-3 pt-3 border-t border-[#1C244B]/10 flex items-center justify-between gap-3">
        <span className="text-xs text-gray-500 inline-flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
          {adresse ? (
            <span className="truncate">
              Start: <span className="text-gray-700 font-500">{adresse}</span>
            </span>
          ) : (
            "Start: von zuhause"
          )}
        </span>
        <button
          type="button"
          onClick={() => setOffen(true)}
          className="text-xs font-600 text-[#1C244B] hover:underline flex-shrink-0"
        >
          {adresse ? "Ändern" : "Woanders starten"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#1C244B]/10 space-y-2">
      <p className="text-xs text-gray-500 leading-snug">
        Wo bist du kurz vor der ersten Lektion? Bei Hochschule oder Arbeit die
        Adresse dort. Der Heimweg am Abend geht weiterhin nach Hause.
      </p>
      <div className="flex gap-2">
        <input
          value={wert}
          onChange={(e) => setWert(e.target.value)}
          placeholder="Lagerstrasse 2, 8090 Zürich"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#1C244B]"
        />
        <button
          type="button"
          onClick={() => speichern(wert)}
          disabled={laeuft}
          className="text-xs font-600 px-3 rounded-lg bg-[#1C244B] text-white disabled:opacity-40 inline-flex items-center gap-1.5"
        >
          {laeuft && <Loader2 className="w-3 h-3 animate-spin" />}
          Speichern
        </button>
        {adresse && (
          <button
            type="button"
            title="Zurück auf zuhause"
            onClick={() => speichern("")}
            disabled={laeuft}
            className="px-2 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {fehler && <p className="text-xs text-red-600">{fehler}</p>}
    </div>
  );
}
