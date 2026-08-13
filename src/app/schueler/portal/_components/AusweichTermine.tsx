"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2, Info } from "lucide-react";
import { ausweichterminWaehlen } from "../actions";

export type OffenerAusfall = {
  id: string;
  originalStart: string;
  vorschlaege: { start: string; begruendung: string }[];
};

function langesDatum(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kurzesDatum(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Offene Ausfälle mit ihren Ausweichterminen.
 *
 * Wird nur angezeigt, wenn tatsächlich etwas offen ist. Sonst wäre es ein
 * leerer Kasten, der jeden Tag daran erinnert, dass nichts zu tun ist.
 */
export default function AusweichTermine({
  ausfaelle,
}: {
  ausfaelle: OffenerAusfall[];
}) {
  const router = useRouter();
  const [gewaehlt, setGewaehlt] = useState<Record<string, string>>({});
  const [fehler, setFehler] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (ausfaelle.length === 0) return null;

  function buchen(ausfallId: string) {
    const start = gewaehlt[ausfallId];
    if (!start) return;
    setFehler(null);
    setBusyId(ausfallId);
    startTransition(async () => {
      const res = await ausweichterminWaehlen(ausfallId, start);
      if (res.error) {
        setFehler(res.error);
        setBusyId(null);
        return;
      }
      router.refresh();
      setBusyId(null);
    });
  }

  return (
    <div className="space-y-3">
      {ausfaelle.map((a) => (
        <div
          key={a.id}
          className="bg-white rounded-2xl border border-amber-200 overflow-hidden"
        >
          <div className="px-4 sm:px-5 py-3.5 bg-amber-50 border-b border-amber-100 flex items-start gap-2.5">
            <CalendarClock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-600 text-amber-900">
                Lektion vom {langesDatum(a.originalStart)} ist ausgefallen
              </p>
              <p className="text-sm text-amber-800 leading-snug mt-0.5">
                Die Lektion ist dir erhalten. Such dir einen Ausweichtermin aus.
              </p>
            </div>
          </div>

          {a.vorschlaege.length === 0 ? (
            <div className="p-4 sm:p-5 flex gap-2.5">
              <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600 leading-snug">
                Im Moment ist kein passender Ausweichtermin frei. Ich melde mich
                bei dir, deine Laufzeit verlängert sich stattdessen, du
                verlierst nichts.
              </p>
            </div>
          ) : (
            <div className="p-4 sm:p-5 space-y-2">
              {a.vorschlaege.map((v) => {
                const aktiv = gewaehlt[a.id] === v.start;
                return (
                  <button
                    key={v.start}
                    type="button"
                    onClick={() =>
                      setGewaehlt((g) => ({ ...g, [a.id]: v.start }))
                    }
                    className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                      aktiv
                        ? "border-[#1C244B] bg-[#1C244B]/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-600 text-gray-900">
                          {kurzesDatum(v.start)}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {v.begruendung}
                        </p>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${
                          aktiv
                            ? "border-[#1C244B] bg-[#1C244B]"
                            : "border-gray-300"
                        }`}
                      >
                        {aktiv && <Check className="w-3 h-3 text-white" />}
                      </span>
                    </div>
                  </button>
                );
              })}

              <button
                onClick={() => buchen(a.id)}
                disabled={!gewaehlt[a.id] || isPending}
                className="w-full flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl min-h-[44px] hover:bg-[#151c3d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-1"
              >
                {busyId === a.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Wird gebucht…
                  </>
                ) : (
                  "Diesen Termin nehmen"
                )}
              </button>

              <p className="text-xs text-gray-400 text-center leading-snug pt-1">
                Passt keiner davon? Dann melde dich bei mir, deine Laufzeit
                verlängert sich stattdessen.
              </p>
            </div>
          )}
        </div>
      ))}

      {fehler && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>
      )}
    </div>
  );
}
