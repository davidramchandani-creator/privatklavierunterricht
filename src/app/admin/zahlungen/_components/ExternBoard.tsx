"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Undo2 } from "lucide-react";
import {
  externBezahlt,
  externZahlungWiderrufen,
} from "@/app/admin/abrechnung/actions";
import type { ExterneLektion } from "@/lib/externe-zahlungen";

/**
 * Externe Lektionen abrechnen.
 *
 * Sieht aus wie die Liste der offenen Lektionen, tut aber etwas anderes:
 * Hier wird keine Rechnung gestellt, sondern nur festgehalten, dass die
 * Plattform gezahlt hat. Der externe Schüler merkt davon nichts — er
 * bekommt aus diesem System grundsätzlich keine Post.
 */

const chf = (n: number) =>
  n.toLocaleString("de-CH", { style: "currency", currency: "CHF" });

const datum = (iso: string) =>
  new Date(iso).toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

export default function ExternBoard({
  lektionen,
}: {
  lektionen: ExterneLektion[];
}) {
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktiv, setAktiv] = useState<string | null>(null);

  const offen = lektionen.filter((l) => !l.bezahlt && l.gehalten);
  const kommend = lektionen.filter((l) => !l.bezahlt && !l.gehalten);
  const bezahlt = lektionen.filter((l) => l.bezahlt);

  const summeOffen = offen.reduce((s, l) => s + l.erwartet, 0);

  function bestaetigen(l: ExterneLektion) {
    setFehler(null);
    setAktiv(l.appointmentId);
    starte(async () => {
      const res = await externBezahlt(l.appointmentId);
      if ("error" in res && res.error) setFehler(res.error);
      setAktiv(null);
      router.refresh();
    });
  }

  function widerrufen(l: ExterneLektion) {
    setFehler(null);
    setAktiv(l.appointmentId);
    starte(async () => {
      const res = await externZahlungWiderrufen(l.appointmentId);
      if ("error" in res && res.error) setFehler(res.error);
      setAktiv(null);
      router.refresh();
    });
  }

  if (lektionen.length === 0) {
    return (
      <p className="text-sm text-gray-400 bg-[#F9FAFB] rounded-2xl p-6 text-center">
        Keine externen Lektionen.
      </p>
    );
  }

  function Zeile({ l }: { l: ExterneLektion }) {
    const dran = laeuft && aktiv === l.appointmentId;
    return (
      <li className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-600 text-gray-900 truncate">
            {l.name}
            {l.istTest && (
              <span className="ml-2 text-[10px] font-600 text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                Test
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500">
            {datum(l.beginn)}
            {l.plattform ? ` · ${l.plattform}` : ""}
            {l.bezahlt ? ` · bezahlt am ${datum(l.bezahlt.am)}` : ""}
          </p>
        </div>

        <span
          className={`text-sm font-600 tabular-nums ${
            l.bezahlt ? "text-emerald-700" : "text-gray-700"
          }`}
        >
          {chf(l.bezahlt ? l.bezahlt.betrag : l.erwartet)}
        </span>

        {l.bezahlt ? (
          <button
            onClick={() => widerrufen(l)}
            disabled={laeuft}
            title="Bestätigung zurücknehmen"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            {dran ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Undo2 className="w-4 h-4" />
            )}
          </button>
        ) : (
          <button
            onClick={() => bestaetigen(l)}
            disabled={laeuft}
            className="inline-flex items-center gap-1.5 text-xs font-600 px-3 py-1.5 rounded-lg bg-[#1C244B] text-white hover:bg-[#2A3563] transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {dran ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            Bezahlt
          </button>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500 bg-[#F9FAFB] rounded-xl px-3.5 py-2.5 leading-relaxed">
        Externe zahlen über ihre Plattform. Hier hältst du fest, was
        angekommen ist — es wird keine Rechnung erstellt und keine Mail
        verschickt. Bestätigte Beträge zählen in der Abrechnung als belegte
        Einnahme, alles andere bleibt dort eine Schätzung.
      </p>

      {fehler && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2.5">
          {fehler}
        </p>
      )}

      {offen.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-600 text-gray-900">
              Gehalten, noch nicht bestätigt
            </h3>
            <span className="text-xs text-gray-500 tabular-nums">
              {offen.length} · {chf(summeOffen)}
            </span>
          </div>
          <ul className="space-y-1.5">
            {offen.map((l) => (
              <Zeile key={l.appointmentId} l={l} />
            ))}
          </ul>
        </section>
      )}

      {kommend.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-600 text-gray-900">Kommende Lektionen</h3>
          <ul className="space-y-1.5 opacity-60">
            {kommend.map((l) => (
              <Zeile key={l.appointmentId} l={l} />
            ))}
          </ul>
        </section>
      )}

      {bezahlt.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-600 text-gray-900">Bestätigt</h3>
          <ul className="space-y-1.5">
            {bezahlt.map((l) => (
              <Zeile key={l.appointmentId} l={l} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
