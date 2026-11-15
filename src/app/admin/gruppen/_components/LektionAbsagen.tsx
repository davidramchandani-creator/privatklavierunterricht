"use client";

import { useState, useTransition } from "react";
import { gruppenLektionAbsagen } from "../actions";

/** Eine Gruppenlektion für alle absagen, mit Rückfrage. */
export default function LektionAbsagen({ gruppeId, startAt }: { gruppeId: string; startAt: string }) {
  const [frage, setFrage] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  if (!frage) {
    return (
      <button
        type="button"
        onClick={() => setFrage(true)}
        className="text-xs font-600 text-red-600 hover:underline"
      >
        Für alle absagen
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-600">Alle bekommen eine Absage-Mail. Ersatz planst du selbst.</span>
      <button
        type="button"
        disabled={laeuft}
        onClick={() =>
          starte(async () => {
            const r = await gruppenLektionAbsagen(gruppeId, startAt);
            if (!r.ok) setFehler(r.fehler);
            else setFrage(false);
          })
        }
        className="press text-xs font-700 px-3 py-1.5 rounded-lg bg-red-600 text-white disabled:opacity-50"
      >
        {laeuft ? "Sage ab …" : "Ja, absagen"}
      </button>
      <button
        type="button"
        onClick={() => setFrage(false)}
        className="text-xs font-600 text-gray-500 hover:underline"
      >
        Abbrechen
      </button>
      {fehler && <span className="text-xs text-red-700">{fehler}</span>}
    </span>
  );
}
