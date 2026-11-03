"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2, Send } from "lucide-react";
import type { ExternZeile, UmstellungZeile } from "@/lib/semester-umstellung-server";
import { aboUmstellen, externUmstellen } from "../actions";

type Zeile = UmstellungZeile & { mailBetreff: string | null; mailHtml: string | null };

const chf = (n: number) =>
  n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tag = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};
const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export default function UmstellungBoard({ zeilen, externe }: { zeilen: Zeile[]; externe: ExternZeile[] }) {
  const offen = zeilen.filter((z) => !z.erledigt);
  return (
    <div className="space-y-4">
      {offen.length === 0 && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
          Alle laufenden Abos sind umgestellt.
        </p>
      )}
      {zeilen.map((z) => (
        <AboKarte key={z.packageId} z={z} />
      ))}

      {externe.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#EAECEF] p-5 space-y-3">
          <h2 className="text-base font-700 text-[#1C244B]">Externe (ohne Abo, ohne Mail)</h2>
          <p className="text-xs text-gray-500">
            Ihre Termine werden ab heute nach den neuen unterrichtsfreien Zeiten neu gelegt.
          </p>
          {externe.map((e) => (
            <ExternKarte key={e.studentId} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function AboKarte({ z }: { z: Zeile }) {
  const router = useRouter();
  const [mitMail, setMitMail] = useState(true);
  const [mailOffen, setMailOffen] = useState(false);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [laeuft, starte] = useTransition();

  return (
    <div className={`bg-white rounded-2xl border p-5 space-y-3 ${z.erledigt ? "border-emerald-200 opacity-70" : "border-[#EAECEF]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-700 text-gray-900">{z.name}</p>
          <p className="text-xs text-gray-500">
            {z.abo} · {z.platz} · CHF {chf(z.preisProLektion)} pro Lektion
          </p>
        </div>
        {z.erledigt && (
          <span className="inline-flex items-center gap-1 text-xs font-600 text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> umgestellt
          </span>
        )}
      </div>

      {!z.erledigt && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Wert label="Ende" alt={tag(z.endeAlt)} neu={tag(z.endeNeu)} />
            <Wert label="Lektionen" alt={String(z.lektionenAlt)} neu={String(z.lektionenNeu)} />
            <Wert label="Gesamt" alt={`CHF ${chf(z.gesamtAlt)}`} neu={`CHF ${chf(z.gesamtNeu)}`} />
            <Wert label="Rate" alt={`CHF ${chf(z.rateAlt)}`} neu={`CHF ${chf(z.rateNeu)}`} />
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <p>
              Schon bezahlt: CHF {chf(z.bezahlt)}. Offene Raten neu:{" "}
              {z.raten.map((r) => `${tag(r.faellig)} CHF ${chf(r.betragNeu)}`).join(", ") || "keine"}
              {z.ratenWeg > 0 && `. ${z.ratenWeg} Raten nach Semesterende fallen weg.`}
            </p>
            {z.variante === "jahr" && (
              <p>
                Jahresabo: gebunden bis {tag(z.bindungBis)}. Die Raten fürs nächste Semester kommen mit der Verlängerung.
              </p>
            )}
            {z.termineAbsagen.length > 0 && (
              <p>
                <span className="font-600">Wird abgesagt ({z.termineAbsagen.length}):</span> {z.termineAbsagen.join(", ")}
              </p>
            )}
            {z.termineNeu.length > 0 && (
              <p>
                <span className="font-600">Wird neu gebucht ({z.termineNeu.length}):</span> {z.termineNeu.join(", ")}
              </p>
            )}
          </div>

          {z.hinderung && (
            <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {z.hinderung}
            </p>
          )}

          {z.mailHtml && (
            <div className="space-y-2">
              <button
                onClick={() => setMailOffen(!mailOffen)}
                className="inline-flex items-center gap-1 text-xs font-600 text-[#1C244B] underline"
              >
                {mailOffen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Mail ansehen: {z.mailBetreff}
              </button>
              {mailOffen && (
                <iframe
                  title={`Mail an ${z.name}`}
                  srcDoc={z.mailHtml}
                  className="w-full h-[560px] rounded-lg border border-gray-200 bg-white"
                />
              )}
            </div>
          )}

          {!z.hinderung && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={mitMail}
                  onChange={(e) => setMitMail(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300"
                />
                Mail an {z.name.split(" ")[0]} senden
              </label>
              <button
                disabled={laeuft}
                onClick={() => {
                  if (!confirm(`Abo von ${z.name} jetzt umstellen${mitMail ? " und Mail senden" : ""}?`)) return;
                  setMeldung(null);
                  starte(async () => {
                    const r = await aboUmstellen(z.packageId, mitMail);
                    if ("error" in r && r.error) {
                      setMeldung({ text: r.error, fehler: true });
                      return;
                    }
                    setMeldung({ text: mitMail ? "Umgestellt, Mail ist raus." : "Umgestellt, ohne Mail.", fehler: false });
                    router.refresh();
                  });
                }}
                className="inline-flex items-center gap-1.5 text-xs font-600 px-3 py-2 rounded-lg bg-[#1C244B] text-white hover:bg-[#2A3563] disabled:opacity-40"
              >
                {laeuft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Umstellen
              </button>
            </div>
          )}
        </>
      )}

      {meldung && (
        <p className={`text-xs rounded-lg px-3 py-2 ${meldung.fehler ? "text-red-600 bg-red-50" : "text-emerald-700 bg-emerald-50"}`}>
          {meldung.text}
        </p>
      )}
    </div>
  );
}

function Wert({ label, alt, neu }: { label: string; alt: string; neu: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-gray-400 line-through tabular-nums">{alt}</p>
      <p className="font-700 text-gray-900 tabular-nums">{neu}</p>
    </div>
  );
}

function ExternKarte({ e }: { e: ExternZeile }) {
  const router = useRouter();
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
      <div className="text-xs">
        <p className="text-sm font-600 text-gray-900">{e.name}</p>
        <p className="text-gray-500">
          {WOCHENTAG[e.wochentag]} {e.zeit}
          {e.paritaet === null ? "" : e.paritaet === 0 ? ", gerade Wochen" : ", ungerade Wochen"}
        </p>
        <p className="text-gray-600">
          {e.termineImFreien.length > 0
            ? `In Ferien/Praktikum gebucht: ${e.termineImFreien.join(", ")}`
            : "Keine Termine in Ferien oder Praktikum."}
        </p>
        {meldung && <p className="text-emerald-700">{meldung}</p>}
      </div>
      <button
        disabled={laeuft}
        onClick={() =>
          starte(async () => {
            const r = await externUmstellen(e.studentId);
            if ("error" in r && r.error) {
              setMeldung(r.error);
              return;
            }
            if ("termine" in r) setMeldung(`${r.termine} Termine neu gelegt.`);
            router.refresh();
          })
        }
        className="inline-flex items-center gap-1.5 text-xs font-600 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
      >
        {laeuft && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Termine neu legen
      </button>
    </div>
  );
}
