"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { inhaltLabel, verlaufLabel, type Notiz } from "@/lib/lektionsnotizen";
import NotizFormular from "@/app/admin/lektionen/_components/NotizFormular";

const TON: Record<string, string> = {
  sitzt: "bg-emerald-50 text-emerald-700",
  dranbleiben: "bg-amber-50 text-amber-700",
  neu: "bg-navy-50 text-navy-900",
};

function datum(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/**
 * Der Unterrichtsverlauf eines Schülers.
 *
 * Zusammengeklappt bis auf die letzten drei: Wer nachschaut, will fast immer
 * den aktuellen Stand, nicht das Archiv. Alles zu zeigen macht die
 * Schülerseite unbrauchbar lang, sobald jemand ein Jahr dabei ist.
 */
export default function NotizVerlauf({ notizen }: { notizen: Notiz[] }) {
  const [alle, setAlle] = useState(false);
  const [bearbeite, setBearbeite] = useState<string | null>(null);

  if (notizen.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Noch nichts eingetragen. Nach der nächsten Lektion wirst du gefragt.
      </p>
    );
  }

  const sichtbar = alle ? notizen : notizen.slice(0, 3);

  return (
    <div className="space-y-3">
      <ul className="space-y-2.5">
        {sichtbar.map((n) => (
          <li
            key={n.appointment_id}
            className="rounded-xl border border-gray-100 bg-gray-50/60 px-3.5 py-3"
          >
            {bearbeite === n.appointment_id ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-600 text-gray-500">
                    {datum(n.lektion_am)}
                  </span>
                  <button
                    onClick={() => setBearbeite(null)}
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    aria-label="Abbrechen"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <NotizFormular
                  appointmentId={n.appointment_id}
                  vorhanden={n}
                  onFertig={() => setBearbeite(null)}
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-600 text-gray-500">
                    {datum(n.lektion_am)}
                  </span>
                  {n.verlauf && (
                    <span
                      className={`text-[11px] font-600 px-2 py-0.5 rounded-full ${
                        TON[n.verlauf] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {verlaufLabel(n.verlauf)}
                    </span>
                  )}
                  <button
                    onClick={() => setBearbeite(n.appointment_id)}
                    className="ml-auto p-1 rounded-lg text-gray-300 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    aria-label="Bearbeiten"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>

                {n.woran && (
                  <p className="text-sm text-gray-800">{n.woran}</p>
                )}
                {n.hausaufgabe && (
                  <p className="text-sm text-gray-600">
                    <span className="text-gray-400">Aufgabe: </span>
                    {n.hausaufgabe}
                  </p>
                )}
                {n.inhalt.length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {n.inhalt.map(inhaltLabel).join(" · ")}
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {notizen.length > 3 && (
        <button
          onClick={() => setAlle((v) => !v)}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          {alle
            ? "Weniger anzeigen"
            : `Alle ${notizen.length} Einträge anzeigen`}
        </button>
      )}
    </div>
  );
}
