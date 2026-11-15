"use client";

import { useMemo, useState, useTransition } from "react";
import { UsersRound, X } from "lucide-react";
import { gruppeAnlegen, type GruppeFormular as Formular } from "../actions";
import { GRUPPENUNTERRICHT, type Gruppengroesse } from "@/lib/gruppenunterricht";
import { gruppenLektionspreis, gruppenNameAus } from "@/lib/gruppen";

export type Kandidat = {
  id: string;
  name: string;
  vorname: string;
  test: boolean;
  /** Hat schon ein laufendes Abo oder Paket, kann so nicht in eine Gruppe. */
  hatAbo: boolean;
};

const TAGE = [
  { v: 1, l: "Montag" },
  { v: 2, l: "Dienstag" },
  { v: 3, l: "Mittwoch" },
  { v: 4, l: "Donnerstag" },
  { v: 5, l: "Freitag" },
  { v: 6, l: "Samstag" },
  { v: 0, l: "Sonntag" },
];

/**
 * Neue Gruppe: zwei oder drei Schüler, Abo-Art, Rhythmus, fester Platz.
 *
 * Wer schon ein laufendes Abo hat, ist ausgegraut: Ein Schüler hat genau
 * ein aktives Abo, und das Gruppen-Abo ersetzt das Einzelabo nicht still.
 */
export default function GruppeFormular({
  kandidaten,
  startVorschlag,
}: {
  kandidaten: Kandidat[];
  startVorschlag: string;
}) {
  const [offen, setOffen] = useState(false);
  const [mitglieder, setMitglieder] = useState<string[]>(["", ""]);
  const [f, setF] = useState<Omit<Formular, "mitglieder" | "preis">>({
    name: "",
    variante: "halbjahr",
    rhythmus: "woechentlich",
    weekday: 3,
    time: "17:00",
    parity: null,
    periodeStart: startVorschlag,
    mailsSenden: true,
    notiz: "",
  });
  // Eigener Preis, solange David ihn nicht anfasst, folgt er dem Standard.
  const [eigenerPreis, setEigenerPreis] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((alt) => ({ ...alt, [k]: v }));
    setFehler(null);
  };

  const gewaehlt = mitglieder.filter(Boolean);
  const groesse = (gewaehlt.length === 3 ? 3 : 2) as Gruppengroesse;
  const standardPreis = gruppenLektionspreis(groesse, f.variante);
  const preis = eigenerPreis === null ? standardPreis : Number(eigenerPreis);
  const namensVorschlag = useMemo(
    () =>
      gruppenNameAus(
        gewaehlt.map((id) => kandidaten.find((k) => k.id === id)?.vorname ?? "")
      ),
    [gewaehlt, kandidaten]
  );

  function speichern() {
    starte(async () => {
      const r = await gruppeAnlegen({ ...f, preis, mitglieder: gewaehlt });
      if (!r.ok) {
        setFehler(r.fehler);
        return;
      }
      setErfolg(`Gruppe angelegt, ${r.lektionen} Lektionen pro Person gebucht.`);
      setOffen(false);
      setMitglieder(["", ""]);
      setEigenerPreis(null);
    });
  }

  if (!offen) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setErfolg(null);
            setOffen(true);
          }}
          className="press inline-flex items-center gap-1.5 rounded-lg text-sm font-600 px-4 py-2 bg-[#1C244B] text-white hover:bg-[#283366] transition-colors"
        >
          <UsersRound className="w-4 h-4" /> Neue Gruppe
        </button>
        {erfolg && <span className="text-sm font-600 text-emerald-700">{erfolg}</span>}
      </div>
    );
  }

  const feld =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C244B]/20";

  return (
    <div className="w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-800 text-[#1C244B]">Neue Gruppe</h2>
        <button
          type="button"
          onClick={() => setOffen(false)}
          className="p-1 rounded-lg hover:bg-gray-100"
          aria-label="Schliessen"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-600 text-gray-500">Mitglieder</p>
        {mitglieder.map((wert, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              className={feld}
              value={wert}
              onChange={(e) => {
                const neu = [...mitglieder];
                neu[i] = e.target.value;
                setMitglieder(neu);
                setFehler(null);
              }}
            >
              <option value="">{i < 2 ? "Schüler wählen" : "Dritte Person (optional)"}</option>
              {kandidaten.map((k) => (
                <option
                  key={k.id}
                  value={k.id}
                  disabled={k.hatAbo || (mitglieder.includes(k.id) && wert !== k.id)}
                >
                  {k.name}
                  {k.test ? " (Test)" : ""}
                  {k.hatAbo ? " · hat schon ein Abo" : ""}
                </option>
              ))}
            </select>
            {i === 2 && (
              <button
                type="button"
                onClick={() => setMitglieder(mitglieder.slice(0, 2))}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Dritte Person entfernen"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
        ))}
        {mitglieder.length < 3 && (
          <button
            type="button"
            onClick={() => setMitglieder([...mitglieder, ""])}
            className="text-xs font-600 text-[#1C244B] hover:underline"
          >
            + dritte Person
          </button>
        )}
        <p className="text-xs text-gray-400">
          Wer schon ein laufendes Abo hat, muss es zuerst beenden.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="space-y-1 text-xs font-600 text-gray-500 sm:col-span-2">
          Name der Gruppe
          <input
            className={feld}
            placeholder={namensVorschlag}
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs font-600 text-gray-500">
          Abo
          <select
            className={feld}
            value={f.variante}
            onChange={(e) => set("variante", e.target.value as Formular["variante"])}
          >
            <option value="halbjahr">Semesterabo</option>
            <option value="jahr">Jahresabo</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-600 text-gray-500">
          Rhythmus
          <select
            className={feld}
            value={f.rhythmus}
            onChange={(e) => {
              const r = e.target.value as Formular["rhythmus"];
              setF((alt) => ({ ...alt, rhythmus: r, parity: r === "zweiwoechentlich" ? 0 : null }));
            }}
          >
            <option value="woechentlich">Jede Woche</option>
            <option value="zweiwoechentlich">Alle zwei Wochen</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-600 text-gray-500">
          Wochentag
          <select className={feld} value={f.weekday} onChange={(e) => set("weekday", Number(e.target.value))}>
            {TAGE.map((t) => (
              <option key={t.v} value={t.v}>
                {t.l}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-600 text-gray-500">
          Beginn
          <input
            type="time"
            step={300}
            className={feld}
            value={f.time}
            onChange={(e) => set("time", e.target.value)}
          />
        </label>
        {f.rhythmus === "zweiwoechentlich" && (
          <label className="space-y-1 text-xs font-600 text-gray-500">
            Wochen
            <select
              className={feld}
              value={f.parity ?? 0}
              onChange={(e) => set("parity", Number(e.target.value) === 1 ? 1 : 0)}
            >
              <option value={0}>Gerade Wochen</option>
              <option value={1}>Ungerade Wochen</option>
            </select>
          </label>
        )}
        <label className="space-y-1 text-xs font-600 text-gray-500">
          Start der Periode
          <input
            type="date"
            className={feld}
            value={f.periodeStart}
            onChange={(e) => set("periodeStart", e.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs font-600 text-gray-500 sm:col-span-2">
          Notiz (nur für dich)
          <input className={feld} value={f.notiz} onChange={(e) => set("notiz", e.target.value)} />
        </label>
      </div>

      <div className="rounded-xl bg-[#F3F5F8] px-4 py-3 space-y-2">
        <label className="flex items-center gap-3 flex-wrap text-sm text-[#1C244B]">
          <span className="font-600">Preis pro Person und Lektion</span>
          <span className="inline-flex items-center gap-1">
            CHF
            <input
              type="number"
              min={1}
              max={500}
              step={0.05}
              className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C244B]/20"
              value={eigenerPreis ?? String(standardPreis)}
              onChange={(e) => {
                setEigenerPreis(e.target.value);
                setFehler(null);
              }}
            />
          </span>
          {eigenerPreis !== null && Number(eigenerPreis) !== standardPreis && (
            <button
              type="button"
              onClick={() => setEigenerPreis(null)}
              className="text-xs font-600 text-[#1C244B] hover:underline"
            >
              Standard CHF {standardPreis}
            </button>
          )}
        </label>
        <p className="text-xs text-gray-500">
          {GRUPPENUNTERRICHT[groesse].label}, {GRUPPENUNTERRICHT[groesse].minuten} Minuten. Der
          Preis gilt für alle Mitglieder. Lektionszahl und Monatsbetrag werden wie beim
          Einzelabo aus Periode und Ferien gerechnet.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={f.mailsSenden}
          onChange={(e) => set("mailsSenden", e.target.checked)}
        />
        Jedem Mitglied die Abo-Bestätigung mailen
      </label>

      {fehler && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {fehler}
        </div>
      )}

      <button
        type="button"
        disabled={laeuft || gewaehlt.length < 2}
        onClick={speichern}
        className="press text-sm font-700 px-4 py-2 rounded-lg bg-[#1C244B] text-white disabled:opacity-50"
      >
        {laeuft ? "Prüfe und lege an …" : "Gruppe anlegen"}
      </button>
    </div>
  );
}
