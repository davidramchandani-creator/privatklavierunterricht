"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import NotizFormular from "./NotizFormular";

type Offen = {
  appointmentId: string;
  studentId: string;
  name: string;
  beginn: string;
};

function wann(iso: string): string {
  const d = new Date(iso);
  const heute = new Date();
  const gleich = (a: Date, b: Date) =>
    a.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" }) ===
    b.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" });

  const gestern = new Date(heute.getTime() - 86_400_000);
  const uhr = d.toLocaleTimeString("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (gleich(d, heute)) return `heute, ${uhr}`;
  if (gleich(d, gestern)) return `gestern, ${uhr}`;
  return `${d.toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })}, ${uhr}`;
}

export default function OffeneListe({ offen }: { offen: Offen[] }) {
  // Die neueste Lektion ist offen, alle anderen zugeklappt. Wer gerade von
  // einer Stunde kommt, soll nicht erst suchen müssen.
  const [auf, setAuf] = useState<string | null>(
    offen[0]?.appointmentId ?? null
  );
  const [fertig, setFertig] = useState<Set<string>>(new Set());

  return (
    <div className="space-y-2.5">
      {offen.map((l) => {
        const offenJetzt = auf === l.appointmentId;
        const erledigt = fertig.has(l.appointmentId);
        return (
          <div
            key={l.appointmentId}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors ${
              erledigt ? "border-emerald-200" : "border-gray-200"
            }`}
          >
            <button
              onClick={() => setAuf(offenJetzt ? null : l.appointmentId)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-600 text-gray-900 truncate">
                  {l.name}
                </p>
                <p className="text-xs text-gray-500">{wann(l.beginn)}</p>
              </div>
              {erledigt ? (
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                    offenJetzt ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>

            {offenJetzt && !erledigt && (
              <div className="px-4 pb-4 animate-enter-up">
                <NotizFormular
                  appointmentId={l.appointmentId}
                  onFertig={() => {
                    setFertig((v) => new Set(v).add(l.appointmentId));
                    // Direkt die nächste offene Lektion aufklappen: So
                    // arbeitet man einen Abend in einem Zug durch, ohne
                    // zwischendurch zu zielen.
                    const naechste = offen.find(
                      (x) =>
                        x.appointmentId !== l.appointmentId &&
                        !fertig.has(x.appointmentId)
                    );
                    setAuf(naechste?.appointmentId ?? null);
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
