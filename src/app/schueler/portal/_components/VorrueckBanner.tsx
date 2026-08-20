"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpCircle, Check, Loader2, X } from "lucide-react";
import { vorrueckAntworten } from "../actions";
import type { VorrueckAngebot } from "@/lib/vorrueck-server";

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

function nurZeit(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * „Möchtest du früher kommen?" — das Vorrück-Angebot nach einer Absage.
 *
 * Beide Antworten sind gleich prominent. Ein grosser Ja- und ein kleiner
 * Nein-Knopf würden Druck machen, und genau den soll dieses Angebot nicht
 * ausüben: Wer nicht kann, soll sich mit einem Klick guten Gewissens
 * verabschieden können.
 */
export default function VorrueckBanner({
  angebote,
}: {
  angebote: VorrueckAngebot[];
}) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (angebote.length === 0 && !meldung && !fehler) return null;

  function antworten(id: string, annehmen: boolean) {
    setFehler(null);
    setMeldung(null);
    setBusy(id + (annehmen ? ":ja" : ":nein"));
    startTransition(async () => {
      const res = await vorrueckAntworten(id, annehmen);
      setBusy(null);
      if (res.error) {
        setFehler(res.error);
        return;
      }
      setMeldung(
        res.verschoben
          ? "Deine Lektion ist vorverschoben. Danke!"
          : "Alles klar, dein Termin bleibt wie geplant."
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {angebote.map((a) => (
        <div
          key={a.id}
          className="bg-white rounded-2xl border border-indigo-200 overflow-hidden"
        >
          <div className="px-4 sm:px-5 py-3.5 bg-indigo-50 border-b border-indigo-100 flex items-start gap-2.5">
            <ArrowUpCircle className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-600 text-indigo-900">
                Möchtest du am {langesDatum(a.neuer_beginn)} früher kommen?
              </p>
              <p className="text-sm text-indigo-800 leading-snug mt-0.5">
                Vor deiner Lektion ({nurZeit(a.alter_beginn)}) ist ein Platz
                frei geworden. Du könntest schon um{" "}
                <strong>{nurZeit(a.neuer_beginn)}</strong> beginnen. Wenn
                nicht, kein Problem — dann bleibt alles wie geplant.
              </p>
            </div>
          </div>
          <div className="p-4 sm:p-5 flex gap-2">
            <button
              onClick={() => antworten(a.id, true)}
              disabled={busy !== null}
              className="flex-1 flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl min-h-[44px] hover:bg-[#151c3d] disabled:opacity-40 transition-colors"
            >
              {busy === a.id + ":ja" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Ja, gerne früher
            </button>
            <button
              onClick={() => antworten(a.id, false)}
              disabled={busy !== null}
              className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-600 text-sm rounded-xl min-h-[44px] hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              {busy === a.id + ":nein" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
              Passt nicht
            </button>
          </div>
        </div>
      ))}

      {meldung && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
          {meldung}
        </p>
      )}
      {fehler && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
          {fehler}
        </p>
      )}
    </div>
  );
}
