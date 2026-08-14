"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, CreditCard, QrCode } from "lucide-react";
import { abrechnenUndSenden } from "@/app/admin/actions";

export type OffeneLektion = {
  id: string;
  studentName: string;
  /** ISO-Zeitpunkt des Lektionsbeginns. */
  beginn: string;
  betrag: number;
  methode: "twint" | "qr";
  istTest: boolean;
  /** Hat die Lektion bereits stattgefunden? */
  gehalten: boolean;
};

function formatiere(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Lektionen, die stattgefunden haben und noch nicht abgerechnet sind.
 *
 * Der Knopf macht beides auf einmal: Rechnung anlegen und Zahlungsmail
 * verschicken. Getrennt wäre es zwei Handgriffe für einen Vorgang, der im
 * Kopf einer ist.
 *
 * Bewusst keine Sammelaktion für alle. Eine Zahlungsaufforderung geht an
 * einen Menschen und kostet ihn Geld; das soll man je Zeile bewusst
 * auslösen, nicht in einem Rutsch für zwölf.
 */
export default function LektionenBoard({ lektionen }: { lektionen: OffeneLektion[] }) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [, startTransition] = useTransition();

  function abrechnen(l: OffeneLektion) {
    setLaeuft(l.id);
    setMeldung(null);
    startTransition(async () => {
      const r = await abrechnenUndSenden(l.id);
      setLaeuft(null);
      if (r?.error) {
        setMeldung({ id: l.id, text: r.error, ok: false });
      } else {
        setMeldung({ id: l.id, text: "Rechnung gestellt und Mail verschickt.", ok: true });
        router.refresh();
      }
    });
  }

  if (lektionen.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-8 text-center">
        <p className="text-gray-500">Keine offenen Lektionen.</p>
        <p className="text-sm text-gray-400 mt-1">
          Alle Lektionen mit Abrechnung pro Lektion sind fakturiert.
        </p>
      </div>
    );
  }

  const gehaltene = lektionen.filter((l) => l.gehalten);
  const kommende = lektionen.filter((l) => !l.gehalten);

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        Lektionen mit Abrechnung pro Lektion, für die noch keine Rechnung
        besteht. Der Knopf stellt die Rechnung und verschickt die
        Zahlungsaufforderung sofort — auch im Voraus, wenn du das willst.
      </p>

      {/*
        Als Funktionsaufruf, nicht als <Gruppe/>: Eine im Render definierte
        Komponente bekäme bei jedem Durchlauf eine neue Identität, und React
        würde die Zeilen samt DOM neu aufbauen.
      */}
      {gehaltene.length > 0 && Gruppe({ titel: "Gehalten", lektionen: gehaltene })}
      {kommende.length > 0 &&
        Gruppe({
          titel: "Kommend",
          hinweis: "Diese Lektionen stehen noch aus. Abrechnen ist trotzdem möglich.",
          lektionen: kommende,
        })}
    </div>
  );

  function Gruppe({
    titel,
    hinweis,
    lektionen,
  }: {
    titel: string;
    hinweis?: string;
    lektionen: OffeneLektion[];
  }) {
    return (
    <div className="space-y-2">
      <p className="text-xs font-700 uppercase tracking-widest text-gray-400">
        {titel}
      </p>
      {hinweis && <p className="text-xs text-gray-400">{hinweis}</p>}
      <div className="bg-white rounded-2xl border border-[#EAECEF] overflow-hidden">
        {lektionen.map((l, i) => (
          <div
            key={l.id}
            className={`flex items-center justify-between gap-4 p-4 ${
              i > 0 ? "border-t border-[#EAECEF]" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="font-600 text-navy-900 truncate">
                {l.studentName}
                {l.istTest && (
                  <span className="ml-2 text-[11px] font-600 uppercase tracking-wide text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                    Test
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {formatiere(l.beginn)}
                <span className="mx-1.5 text-gray-300">·</span>
                CHF {l.betrag.toFixed(2)}
                <span className="mx-1.5 text-gray-300">·</span>
                <span className="inline-flex items-center gap-1">
                  {l.methode === "qr" ? (
                    <QrCode className="w-3.5 h-3.5" />
                  ) : (
                    <CreditCard className="w-3.5 h-3.5" />
                  )}
                  {l.methode === "qr" ? "QR-Rechnung" : "TWINT"}
                </span>
              </p>
              {meldung?.id === l.id && (
                <p
                  className={`text-sm mt-1.5 ${
                    meldung.ok ? "text-status-paid" : "text-status-error"
                  }`}
                >
                  {meldung.text}
                </p>
              )}
            </div>

            <button
              onClick={() => abrechnen(l)}
              disabled={laeuft !== null}
              className="press shrink-0 inline-flex items-center gap-2 bg-navy-900 text-white text-sm font-600 px-4 py-2 rounded-xl hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {laeuft === l.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Abrechnen
            </button>
          </div>
        ))}
      </div>
    </div>
    );
  }
}
