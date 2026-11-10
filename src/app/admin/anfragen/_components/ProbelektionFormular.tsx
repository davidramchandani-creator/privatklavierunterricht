"use client";

import { useState, useTransition } from "react";
import { CalendarPlus, X } from "lucide-react";
import { probelektionEintragen } from "../actions";
import { PROBELEKTION_MINUTEN } from "@/lib/probelektion";

export type Vorlage = {
  anfrageId?: string;
  vorname?: string;
  nachname?: string;
  email?: string;
  telefon?: string | null;
  /** ISO, vom Wunschtermin der Anfrage */
  wunschtermin?: string | null;
};

function zuDatumZeit(iso?: string | null): { datum: string; zeit: string } {
  if (!iso) return { datum: "", zeit: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { datum: "", zeit: "" };
  const datum = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich" }).format(d);
  const zeit = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return { datum, zeit };
}

/**
 * Probelektion eintragen: aus einer Anfrage (vorausgefüllt) oder von Hand.
 * Sperrt die Zeit im Buchungskalender, die Mail ist freiwillig.
 */
export default function ProbelektionFormular({
  vorlage = {},
  knopfText = "Probelektion eintragen",
  klein = false,
}: {
  vorlage?: Vorlage;
  knopfText?: string;
  klein?: boolean;
}) {
  const [offen, setOffen] = useState(false);
  const start = zuDatumZeit(vorlage.wunschtermin);
  const [f, setF] = useState({
    vorname: vorlage.vorname ?? "",
    nachname: vorlage.nachname ?? "",
    email: vorlage.email ?? "",
    telefon: vorlage.telefon ?? "",
    datum: start.datum,
    zeit: start.zeit,
    minuten: PROBELEKTION_MINUTEN,
    notiz: "",
    mailSenden: Boolean(vorlage.email),
  });
  const [fehler, setFehler] = useState<string | null>(null);
  const [konflikte, setKonflikte] = useState<string[] | null>(null);
  const [erfolg, setErfolg] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((alt) => ({ ...alt, [k]: v }));
    setKonflikte(null);
    setFehler(null);
  };

  function speichern(trotzdem = false) {
    starte(async () => {
      const r = await probelektionEintragen({ ...f, anfrageId: vorlage.anfrageId ?? null, trotzdem });
      if (!r.ok) {
        setFehler(r.fehler);
        setKonflikte(r.konflikte ?? null);
        return;
      }
      setErfolg(
        r.mail === "gesendet"
          ? "Eingetragen, Mail ist raus."
          : r.mail === "fehlgeschlagen"
            ? "Eingetragen, aber die Mail konnte nicht gesendet werden."
            : "Eingetragen."
      );
      setOffen(false);
    });
  }

  if (!offen) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setErfolg(null);
            setOffen(true);
          }}
          className={`press inline-flex items-center gap-1.5 rounded-lg font-600 transition-colors ${
            klein
              ? "text-xs px-3 py-1.5 bg-sky-50 text-sky-800 hover:bg-sky-100"
              : "text-sm px-4 py-2 bg-[#1C244B] text-white hover:bg-[#283366]"
          }`}
        >
          <CalendarPlus className={klein ? "w-3.5 h-3.5" : "w-4 h-4"} /> {knopfText}
        </button>
        {erfolg && <span className="text-xs font-600 text-emerald-700">{erfolg}</span>}
      </div>
    );
  }

  const feld = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C244B]/20";

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-800 text-[#1C244B]">Probelektion eintragen</h3>
        <button type="button" onClick={() => setOffen(false)} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Schliessen">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="space-y-1 text-xs font-600 text-gray-500">
          Vorname
          <input className={feld} value={f.vorname} onChange={(e) => set("vorname", e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-600 text-gray-500">
          Nachname
          <input className={feld} value={f.nachname} onChange={(e) => set("nachname", e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-600 text-gray-500">
          E-Mail
          <input type="email" className={feld} value={f.email} onChange={(e) => set("email", e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-600 text-gray-500">
          Telefon
          <input className={feld} value={f.telefon} onChange={(e) => set("telefon", e.target.value)} />
        </label>
        <label className="space-y-1 text-xs font-600 text-gray-500">
          Datum
          <input type="date" className={feld} value={f.datum} onChange={(e) => set("datum", e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs font-600 text-gray-500">
            Beginn
            <input type="time" step={300} className={feld} value={f.zeit} onChange={(e) => set("zeit", e.target.value)} />
          </label>
          <label className="space-y-1 text-xs font-600 text-gray-500">
            Minuten
            <input
              type="number"
              min={15}
              max={180}
              step={5}
              className={feld}
              value={f.minuten}
              onChange={(e) => set("minuten", Number(e.target.value))}
            />
          </label>
        </div>
        <label className="space-y-1 text-xs font-600 text-gray-500 sm:col-span-2">
          Notiz (nur für dich)
          <input className={feld} value={f.notiz} onChange={(e) => set("notiz", e.target.value)} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={f.mailSenden} onChange={(e) => set("mailSenden", e.target.checked)} />
        Bestätigung per Mail senden
      </label>

      {fehler && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 space-y-1">
          <p className="font-600">{fehler}</p>
          {konflikte && (
            <ul className="list-disc pl-5">
              {konflikte.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={laeuft}
          onClick={() => speichern(false)}
          className="press text-sm font-700 px-4 py-2 rounded-lg bg-[#1C244B] text-white disabled:opacity-50"
        >
          {laeuft ? "Speichere …" : "Eintragen"}
        </button>
        {konflikte && (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => speichern(true)}
            className="press text-sm font-600 px-4 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 disabled:opacity-50"
          >
            Trotzdem eintragen
          </button>
        )}
      </div>
    </div>
  );
}
