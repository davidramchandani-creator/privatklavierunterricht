"use client";

import { useState } from "react";

/**
 * Aktive und nicht mehr aktive Schüler getrennt.
 *
 * Vorher standen alle in einer Liste, unterschieden nur durch ein graues
 * Abzeichen am rechten Rand. Wer nicht mehr kommt, verschwindet damit nicht —
 * er steht mitten zwischen denen, die kommen, und muss bei jedem Blick in die
 * Liste erneut übersehen werden.
 *
 * Löschen wäre die falsche Antwort: Termine, Rechnungen und die Abrechnung
 * hängen an diesen Einträgen. Sie gehören also weiterhin sichtbar, nur nicht
 * im Weg.
 */
export default function SchuelerReiter({
  aktiv,
  inaktiv,
  anzahlAktiv,
  anzahlInaktiv,
}: {
  aktiv: React.ReactNode;
  inaktiv: React.ReactNode;
  anzahlAktiv: number;
  anzahlInaktiv: number;
}) {
  const [reiter, setReiter] = useState<"aktiv" | "inaktiv">("aktiv");

  const REITER = [
    { id: "aktiv" as const, label: "Aktiv", anzahl: anzahlAktiv },
    { id: "inaktiv" as const, label: "Nicht aktiv", anzahl: anzahlInaktiv },
  ];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Schülerauswahl"
        className="flex gap-1 bg-[#F4F5F7] p-1 rounded-2xl w-fit"
      >
        {REITER.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={reiter === r.id}
            onClick={() => setReiter(r.id)}
            className={`text-sm font-600 px-4 py-2 rounded-xl transition-colors inline-flex items-center gap-2 ${
              reiter === r.id
                ? "bg-white text-[#1C244B] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {r.label}
            {/* Die Zahl beantwortet „sind da überhaupt welche?" ohne Klick. */}
            <span
              className={`text-[11px] font-700 rounded-full px-1.5 min-w-[18px] text-center ${
                reiter === r.id
                  ? "bg-[#1C244B] text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {r.anzahl}
            </span>
          </button>
        ))}
      </div>

      {reiter === "aktiv" ? aktiv : inaktiv}
    </div>
  );
}
