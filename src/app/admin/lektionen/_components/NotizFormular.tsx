"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { INHALTE, VERLAEUFE } from "@/lib/lektionsnotizen";
import { speichereNotiz } from "../actions";

/**
 * Das Schnellformular.
 *
 * Der ganze Zweck ist Geschwindigkeit: Wenn es länger dauert als eine halbe
 * Minute, wird es nach zwei Wochen nicht mehr ausgefüllt, und dann ist die
 * ganze Funktion wertlos. Darum Knöpfe statt Auswahlfelder, kein Pflichtfeld
 * und kein Bestätigungsdialog.
 *
 * Die Knöpfe sind mindestens 40px hoch — mit dem Daumen im Auto vor der
 * nächsten Tür bedienbar.
 */
export default function NotizFormular({
  appointmentId,
  vorhanden,
  onFertig,
}: {
  appointmentId: string;
  /** Beim Nachbearbeiten die bestehende Notiz. */
  vorhanden?: {
    inhalt: string[];
    verlauf: string | null;
    woran: string | null;
    hausaufgabe: string | null;
  };
  onFertig?: () => void;
}) {
  const [inhalt, setInhalt] = useState<string[]>(vorhanden?.inhalt ?? []);
  const [verlauf, setVerlauf] = useState<string | null>(
    vorhanden?.verlauf ?? null
  );
  const [woran, setWoran] = useState(vorhanden?.woran ?? "");
  const [hausaufgabe, setHausaufgabe] = useState(vorhanden?.hausaufgabe ?? "");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const [laeuft, starte] = useTransition();

  function kippe(id: string) {
    setFehler(null);
    setInhalt((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  function sichern() {
    setFehler(null);
    starte(async () => {
      const r = await speichereNotiz({
        appointmentId,
        inhalt,
        verlauf,
        woran,
        hausaufgabe,
      });
      if ("error" in r && r.error) {
        setFehler(r.error);
        return;
      }
      setGespeichert(true);
      onFertig?.();
    });
  }

  if (gespeichert) {
    return (
      <p className="flex items-center gap-2 text-sm font-600 text-emerald-700 py-2">
        <Check className="w-4 h-4" />
        Eingetragen.
      </p>
    );
  }

  return (
    <div className="space-y-3.5">
      <div>
        <p className="text-xs font-600 text-gray-400 uppercase tracking-wide mb-1.5">
          Woran gearbeitet
        </p>
        <div className="flex flex-wrap gap-1.5">
          {INHALTE.map((i) => {
            const an = inhalt.includes(i.id);
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => kippe(i.id)}
                aria-pressed={an}
                className={`press text-sm font-600 px-3.5 py-2 rounded-xl border transition-colors ${
                  an
                    ? "bg-[#1C244B] text-white border-[#1C244B]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                {i.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-600 text-gray-400 uppercase tracking-wide mb-1.5">
          Wie lief es
        </p>
        <div className="flex flex-wrap gap-1.5">
          {VERLAEUFE.map((v) => {
            const an = verlauf === v.id;
            // Nochmals antippen hebt die Auswahl auf. Ohne das müsste man
            // einen Fehlgriff über einen Umweg korrigieren.
            const farben =
              v.ton === "success"
                ? "bg-emerald-600 border-emerald-600"
                : v.ton === "pending"
                  ? "bg-amber-500 border-amber-500"
                  : "bg-[#1C244B] border-[#1C244B]";
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={an}
                onClick={() => setVerlauf(an ? null : v.id)}
                className={`press text-sm font-600 px-3.5 py-2 rounded-xl border transition-colors ${
                  an
                    ? `${farben} text-white`
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <input
          value={woran}
          onChange={(e) => setWoran(e.target.value)}
          placeholder="Stück, Stelle, Beobachtung"
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-[#1C244B] focus:outline-none"
        />
        <input
          value={hausaufgabe}
          onChange={(e) => setHausaufgabe(e.target.value)}
          placeholder="Bis nächstes Mal üben"
          className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:border-[#1C244B] focus:outline-none"
        />
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      <button
        onClick={sichern}
        disabled={laeuft}
        className="press w-full inline-flex items-center justify-center gap-2 text-sm font-600 px-4 py-3 rounded-xl bg-[#1C244B] text-white hover:bg-[#2A3563] transition-colors disabled:opacity-40"
      >
        {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Speichern
      </button>
    </div>
  );
}
