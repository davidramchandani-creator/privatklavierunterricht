"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { externenAnlegen } from "@/app/admin/actions";

const TAGE = [
  { nr: 1, lang: "Montag" },
  { nr: 2, lang: "Dienstag" },
  { nr: 3, lang: "Mittwoch" },
  { nr: 4, lang: "Donnerstag" },
  { nr: 5, lang: "Freitag" },
  { nr: 6, lang: "Samstag" },
  { nr: 0, lang: "Sonntag" },
];

function feld(label: string, hinweis?: string) {
  return (
    <>
      <label className="text-xs font-600 text-gray-600">{label}</label>
      {hinweis && (
        <span className="block text-xs text-gray-400 mb-1">{hinweis}</span>
      )}
    </>
  );
}

const input =
  "w-full rounded-lg border border-gray-200 px-3.5 min-h-[44px] text-sm focus:outline-none focus:border-[#1C244B]";

/**
 * Externen Schüler erfassen.
 *
 * Bewusst ein eigenes Formular und nicht das normale „Schüler anlegen": Dort
 * geht es um Einladung, Konto und Preise — alles Dinge, die es hier nicht
 * gibt. Stattdessen wird gefragt, was extern abgemacht wurde, denn genau das
 * bildet der Kalender ab.
 */
export default function ExternerForm() {
  const router = useRouter();
  const [rhythmus, setRhythmus] = useState<"woechentlich" | "zweiwoechentlich">(
    "woechentlich"
  );
  const [umfang, setUmfang] = useState<"unbefristet" | "anzahl">("unbefristet");
  const [fehler, setFehler] = useState<string | null>(null);
  const [kollisionen, setKollisionen] = useState<string[]>([]);
  const [laeuft, starte] = useTransition();

  function absenden(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFehler(null);
    setKollisionen([]);
    const daten = new FormData(e.currentTarget);
    daten.set("rhythmus", rhythmus);
    daten.set("umfang", umfang);

    starte(async () => {
      const res = await externenAnlegen(daten);
      if ("error" in res && res.error) {
        setFehler(res.error);
        return;
      }
      if ("kollisionen" in res && res.kollisionen.length > 0) {
        // Nicht wegklicken lassen: Zwei Verpflichtungen zur selben Zeit sind
        // ein echtes Problem, und im Kalender fällt es leicht unter.
        setKollisionen(res.kollisionen);
        router.refresh();
        return;
      }
      router.push("/admin/schueler");
    });
  }

  if (kollisionen.length > 0) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-5 space-y-3">
        <p className="font-600 text-amber-900 inline-flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Angelegt, aber {kollisionen.length}{" "}
          {kollisionen.length === 1 ? "Termin überschneidet" : "Termine überschneiden"}{" "}
          sich
        </p>
        <p className="text-sm text-gray-600 leading-snug">
          Der Schüler und seine Termine sind im Kalender. An diesen Daten hast
          du aber bereits einen anderen Termin — den extern vereinbarten kannst
          du nicht verschieben, den eigenen schon.
        </p>
        <ul className="text-sm text-gray-700 space-y-1">
          {kollisionen.map((k) => (
            <li key={k}>
              {new Date(k).toLocaleString("de-CH", {
                timeZone: "Europe/Zurich",
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </li>
          ))}
        </ul>
        <button
          onClick={() => router.push("/admin/kalender")}
          className="press text-sm font-600 px-4 min-h-[44px] rounded-xl bg-[#1C244B] text-white"
        >
          Im Kalender ansehen
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={absenden}
      className="bg-white rounded-2xl border border-[#EAECEF] p-5 space-y-5"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          {feld("Vorname")}
          <input name="vorname" required className={input} />
        </div>
        <div className="space-y-1">
          {feld("Nachname")}
          <input name="nachname" required className={input} />
        </div>
      </div>

      <div className="space-y-1">
        {feld("Adresse", "Strasse Nummer, PLZ Ort — wird für die Route gebraucht")}
        <input
          name="adresse"
          required
          placeholder="Bahnhofstrasse 12, 8400 Winterthur"
          className={input}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          {feld("Plattform")}
          <input name="plattform" placeholder="Matchspace" className={input} />
        </div>
        <div className="space-y-1">
          {feld("Telefon")}
          <input name="telefon" className={input} />
        </div>
        <div className="space-y-1">
          {feld("Ertrag pro Lektion")}
          <input
            name="ertrag"
            type="number"
            step="0.05"
            placeholder="60"
            className={input}
          />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-5 space-y-4">
        <p className="font-600 text-[#1C244B]">Was ist abgemacht?</p>

        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              { wert: "woechentlich" as const, titel: "Jede Woche" },
              { wert: "zweiwoechentlich" as const, titel: "Alle zwei Wochen" },
            ]
          ).map((o) => (
            <button
              key={o.wert}
              type="button"
              onClick={() => setRhythmus(o.wert)}
              className={`text-left rounded-xl border p-3.5 text-sm font-600 transition-colors ${
                rhythmus === o.wert
                  ? "border-[#1C244B] bg-[#1C244B]/[0.04] text-gray-900"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              {o.titel}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            {feld("Wochentag")}
            <select name="wochentag" required className={`${input} bg-white`}>
              {TAGE.map((t) => (
                <option key={t.nr} value={t.nr}>
                  {t.lang}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            {feld("Uhrzeit")}
            <input name="zeit" type="time" required className={input} />
          </div>
          <div className="space-y-1">
            {feld("Dauer")}
            <select name="dauer" defaultValue="45" className={`${input} bg-white`}>
              <option value="30">30 Minuten</option>
              <option value="45">45 Minuten</option>
              <option value="60">60 Minuten</option>
            </select>
          </div>
        </div>

        {rhythmus === "zweiwoechentlich" && (
          <div className="space-y-1">
            {feld("In welchen Wochen?")}
            <select name="paritaet" defaultValue="0" className={`${input} bg-white`}>
              <option value="0">Gerade Kalenderwochen</option>
              <option value="1">Ungerade Kalenderwochen</option>
            </select>
          </div>
        )}

        <div className="space-y-1">
          {feld("Erster Termin ab")}
          <input name="start_datum" type="date" required className={input} />
        </div>

        <div>
          <p className="text-xs font-600 text-gray-600 mb-2">Wie lange?</p>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                {
                  wert: "unbefristet" as const,
                  titel: "Läuft weiter",
                  text: "Ein halbes Jahr im Voraus, wächst automatisch nach",
                },
                {
                  wert: "anzahl" as const,
                  titel: "Feste Anzahl",
                  text: "z. B. 10 oder 20 Termine",
                },
              ]
            ).map((o) => (
              <button
                key={o.wert}
                type="button"
                onClick={() => setUmfang(o.wert)}
                className={`text-left rounded-xl border p-3.5 transition-colors ${
                  umfang === o.wert
                    ? "border-[#1C244B] bg-[#1C244B]/[0.04]"
                    : "border-gray-200"
                }`}
              >
                <span className="block font-600 text-sm text-gray-900">
                  {o.titel}
                </span>
                <span className="block text-xs text-gray-500 mt-0.5 leading-snug">
                  {o.text}
                </span>
              </button>
            ))}
          </div>

          {umfang === "anzahl" && (
            <input
              name="anzahl"
              type="number"
              min={1}
              max={100}
              required
              placeholder="Anzahl Termine"
              className={`${input} mt-2.5`}
            />
          )}
        </div>
      </div>

      <div className="space-y-1">
        {feld("Notizen")}
        <textarea name="notizen" rows={2} className={`${input} py-2.5`} />
      </div>

      {fehler && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
          {fehler}
        </p>
      )}

      <button
        type="submit"
        disabled={laeuft}
        className="w-full flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl min-h-[48px] hover:bg-[#151c3d] disabled:opacity-40"
      >
        {laeuft ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Wird angelegt…
          </>
        ) : (
          <>
            <Check className="w-4 h-4" /> Anlegen und Termine eintragen
          </>
        )}
      </button>

      <p className="text-xs text-gray-400 text-center leading-snug">
        Dieser Schüler bekommt kein Konto, keine Rechnung und keine E-Mail. Er
        erscheint im Kalender, blockiert die Zeit und zählt in der
        Routenplanung mit.
      </p>
    </form>
  );
}
