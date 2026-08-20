"use client";

import { useState, useTransition } from "react";
import { Car, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { guenstigeSlots } from "@/app/admin/actions";
import type { BewerteterSlot, SlotKategorie } from "@/lib/slot-bewertung";

/**
 * Freie Slots, sortiert nach dem, was sie wirklich kosten.
 *
 * Für Direktbuchung und Terminvorschlag: Statt ein Datum ins Blaue zu
 * tippen, wählt David aus einer Liste, in der die routengünstigen Slots
 * oben stehen. Ein Klick übernimmt die Zeit ins Formular — gebucht wird
 * weiterhin über den normalen Weg, samt aller Prüfungen.
 */

const KATEGORIE_STYLE: Record<
  SlotKategorie,
  { label: string; klasse: string }
> = {
  anschluss: {
    label: "günstig",
    klasse: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  zwischenhalt: {
    label: "ok",
    klasse: "bg-gray-50 text-gray-600 border-gray-200",
  },
  leerer_tag: {
    label: "eigener Weg",
    klasse: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

function slotDatum(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ISO → Wert für ein datetime-local-Feld, in Zürcher Ortszeit. */
function alsLocalInput(iso: string): string {
  const teile = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  // sv-SE liefert "YYYY-MM-DD HH:MM" — das Feld will ein T dazwischen.
  return teile.replace(" ", "T");
}

export default function GuenstigeSlots({
  studentUserId,
  onPick,
}: {
  studentUserId: string;
  onPick: (localDateTime: string) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [woche, setWoche] = useState(0);
  const [slots, setSlots] = useState<BewerteterSlot[] | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function laden(zielWoche: number) {
    setFehler(null);
    starte(async () => {
      const res = await guenstigeSlots(studentUserId, zielWoche);
      if ("error" in res) {
        setFehler(res.error ?? "Unbekannter Fehler.");
        return;
      }
      setSlots(res.slots);
      setHinweis(res.hinweis);
      setWoche(zielWoche);
    });
  }

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => {
          setOffen(true);
          laden(0);
        }}
        className="flex items-center gap-1.5 text-xs font-600 text-[#1C244B] hover:underline"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Günstige Zeiten anzeigen
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-[#FAFBFC] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-600 text-gray-700">
          Günstige Zeiten — sortiert nach Fahrzeit-Kosten
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => laden(woche - 1)}
            disabled={laeuft || woche <= 0}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
            title="Woche zurück"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 min-w-[90px] text-center">
            {woche === 0 ? "diese Woche" : `in ${woche} Wo.`}
          </span>
          <button
            type="button"
            onClick={() => laden(woche + 1)}
            disabled={laeuft}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
            title="Woche vor"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {laeuft && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Wird gerechnet…
        </p>
      )}

      {fehler && <p className="text-xs text-red-600">{fehler}</p>}
      {hinweis && !laeuft && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
          {hinweis}
        </p>
      )}

      {!laeuft && slots != null && slots.length === 0 && (
        <p className="text-xs text-gray-400">
          In dieser Woche ist kein Slot frei.
        </p>
      )}

      {!laeuft && slots != null && slots.length > 0 && (
        <ul className="space-y-1">
          {slots.slice(0, 8).map((s) => {
            const stil = KATEGORIE_STYLE[s.kategorie];
            return (
              <li key={s.beginn}>
                <button
                  type="button"
                  onClick={() => onPick(alsLocalInput(s.beginn))}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-left hover:border-[#1C244B]/40 transition-colors"
                >
                  <span className="text-xs font-600 text-gray-900 whitespace-nowrap">
                    {slotDatum(s.beginn)}
                  </span>
                  <span className="text-[11px] text-gray-500 truncate flex-1">
                    {s.begruendung}
                  </span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    {s.zusatzfahrtSekunden > 0 && (
                      <span className="text-[11px] text-gray-400 inline-flex items-center gap-0.5">
                        <Car className="w-3 h-3" />+
                        {Math.round(s.zusatzfahrtSekunden / 60)} Min.
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-600 px-1.5 py-0.5 rounded border ${stil.klasse}`}
                    >
                      {stil.label}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setOffen(false)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Einklappen
      </button>
    </div>
  );
}
