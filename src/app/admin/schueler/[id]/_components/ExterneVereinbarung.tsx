"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { externeVereinbarungSpeichern } from "@/app/admin/actions";

/**
 * Die Vereinbarung eines externen Schülers.
 *
 * Steht dort, wo bei den eigenen Schülern Paket und Preise stehen — und
 * ersetzt beides. Ein externer Schüler hat kein Paket und keinen Preis in
 * diesem System: Was er zahlt, regelt die Plattform. Hier steht nur, wann
 * er kommt und was dabei für David herausschaut.
 *
 * Warum die alte Anzeige nicht taugte: Auf der Schülerseite standen für
 * Externe dieselben Knöpfe wie für alle — „Paket anlegen", Preise,
 * Zahlungsart. Wer sie benutzte, erzeugte Rechnungen für jemanden ohne
 * Rechnungsadresse. Jetzt sind sie hier gar nicht mehr da.
 */

const WOCHENTAGE = [
  { wert: 1, name: "Montag" },
  { wert: 2, name: "Dienstag" },
  { wert: 3, name: "Mittwoch" },
  { wert: 4, name: "Donnerstag" },
  { wert: 5, name: "Freitag" },
  { wert: 6, name: "Samstag" },
  { wert: 0, name: "Sonntag" },
];

export type VereinbarungDaten = {
  plattform: string | null;
  externerErtrag: number | null;
  rhythmus: string;
  wochentag: number | null;
  zeit: string | null;
  lektionMinuten: number;
  paritaet: number | null;
  anzahl: number | null;
  startDatum: string;
  /** Wie viele Termine noch im Kalender stehen. */
  kommendeTermine: number;
};

export default function ExterneVereinbarung({
  studentId,
  daten,
}: {
  studentId: string;
  daten: VereinbarungDaten;
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const [plattform, setPlattform] = useState(daten.plattform ?? "");
  const [ertrag, setErtrag] = useState(
    daten.externerErtrag != null ? String(daten.externerErtrag) : ""
  );
  const [rhythmus, setRhythmus] = useState(daten.rhythmus);
  const [dauer, setDauer] = useState(String(daten.lektionMinuten));
  const [wochentag, setWochentag] = useState(
    daten.wochentag != null ? String(daten.wochentag) : ""
  );
  const [zeit, setZeit] = useState(daten.zeit?.slice(0, 5) ?? "");
  const [paritaet, setParitaet] = useState(String(daten.paritaet ?? 0));
  const [abDatum, setAbDatum] = useState(new Date().toISOString().slice(0, 10));

  function speichern(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setHinweis(null);
    const fd = new FormData();
    fd.set("student_id", studentId);
    fd.set("plattform", plattform);
    fd.set("externer_ertrag", ertrag);
    fd.set("rhythmus", rhythmus);
    fd.set("lektion_minuten", dauer);
    fd.set("wochentag", wochentag);
    fd.set("zeit", zeit);
    fd.set("paritaet", paritaet);
    fd.set("ab_datum", abDatum);

    starte(async () => {
      const res = await externeVereinbarungSpeichern(fd);
      if ("error" in res && res.error) {
        setFehler(res.error);
        return;
      }
      setHinweis(
        "termine" in res && res.termine > 0
          ? `Gespeichert, ${res.termine} Termine angelegt.`
          : "Gespeichert. Ohne festen Termin sucht die Zuteilung den Platz."
      );
      setOffen(false);
      router.refresh();
    });
  }

  const terminText =
    daten.wochentag != null && daten.zeit
      ? `${WOCHENTAGE.find((w) => w.wert === daten.wochentag)?.name ?? "?"}, ${daten.zeit.slice(0, 5)}`
      : "noch offen — wird über die Planung zugeteilt";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-700 text-[#1C244B]">Vereinbarung</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Externer Schüler — abgerechnet wird über die Plattform, nicht hier.
          </p>
        </div>
        <button
          onClick={() => setOffen((o) => !o)}
          className="inline-flex items-center gap-1.5 text-xs font-600 text-[#1C244B] px-3 py-1.5 rounded-lg border border-[#1C244B]/20 hover:bg-[#1C244B]/5 transition-colors"
        >
          <Pencil className="w-3 h-3" />
          {offen ? "Abbrechen" : "Ändern"}
        </button>
      </div>

      {hinweis && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3.5 py-2.5 mb-4">
          {hinweis}
        </p>
      )}
      {fehler && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2.5 mb-4">
          {fehler}
        </p>
      )}

      {!offen ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">
              Plattform
            </p>
            <p className="text-gray-900">{daten.plattform ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">
              Ertrag pro Lektion
            </p>
            <p className="text-gray-900">
              {daten.externerErtrag != null
                ? daten.externerErtrag.toLocaleString("de-CH", {
                    style: "currency",
                    currency: "CHF",
                  })
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">
              Rhythmus
            </p>
            <p className="text-gray-900">
              {daten.rhythmus === "zweiwoechentlich"
                ? "alle 2 Wochen"
                : "wöchentlich"}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">
              Fester Termin
            </p>
            <p
              className={
                daten.wochentag == null ? "text-amber-700" : "text-gray-900"
              }
            >
              {terminText}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">
              Dauer
            </p>
            <p className="text-gray-900">{daten.lektionMinuten} Min.</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">
              Umfang
            </p>
            <p className="text-gray-900">
              {daten.anzahl != null ? `${daten.anzahl} Termine` : "unbefristet"}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs font-600 uppercase tracking-wide mb-1">
              Im Kalender
            </p>
            <p
              className={
                daten.kommendeTermine === 0 ? "text-amber-700" : "text-gray-900"
              }
            >
              {daten.kommendeTermine === 0
                ? "keine kommenden Termine"
                : `${daten.kommendeTermine} kommende`}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={speichern} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-600 text-gray-600">Plattform</span>
              <input
                value={plattform}
                onChange={(e) => setPlattform(e.target.value)}
                placeholder="Matchspace"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-600 text-gray-600">
                Ertrag pro Lektion (CHF)
              </span>
              <input
                value={ertrag}
                onChange={(e) => setErtrag(e.target.value)}
                inputMode="decimal"
                placeholder="68"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-600 text-gray-600">Rhythmus</span>
              <select
                value={rhythmus}
                onChange={(e) => setRhythmus(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
              >
                <option value="woechentlich">wöchentlich</option>
                <option value="zweiwoechentlich">alle 2 Wochen</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-600 text-gray-600">
                Dauer (Minuten)
              </span>
              <input
                value={dauer}
                onChange={(e) => setDauer(e.target.value)}
                inputMode="numeric"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2"
              />
            </label>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs text-gray-500 leading-relaxed">
              Fester Termin. Leer lassen, wenn die Zuteilung den Platz suchen
              soll — dann braucht der Schüler angegebene Zeiten. Mit Wochentag
              und Uhrzeit werden künftige Termine neu angelegt; bereits
              gehaltene bleiben stehen.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-600 text-gray-600">Wochentag</span>
                <select
                  value={wochentag}
                  onChange={(e) => setWochentag(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
                >
                  <option value="">— offen lassen —</option>
                  {WOCHENTAGE.map((w) => (
                    <option key={w.wert} value={w.wert}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-600 text-gray-600">Uhrzeit</span>
                <input
                  type="time"
                  step={900}
                  value={zeit}
                  onChange={(e) => setZeit(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-600 text-gray-600">Ab</span>
                <input
                  type="date"
                  value={abDatum}
                  onChange={(e) => setAbDatum(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2"
                />
              </label>
            </div>
            {rhythmus === "zweiwoechentlich" && wochentag !== "" && (
              <label className="space-y-1 block max-w-xs">
                <span className="text-xs font-600 text-gray-600">
                  Welche Woche
                </span>
                <select
                  value={paritaet}
                  onChange={(e) => setParitaet(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white"
                >
                  <option value="0">gerade Wochen</option>
                  <option value="1">ungerade Wochen</option>
                </select>
              </label>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={laeuft}
              className="inline-flex items-center gap-2 text-sm font-600 px-4 py-2.5 rounded-xl bg-[#1C244B] text-white hover:bg-[#2A3563] transition-colors disabled:opacity-40"
            >
              {laeuft && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Speichern
            </button>
            <button
              type="button"
              onClick={() => setOffen(false)}
              className="text-sm font-600 px-4 py-2.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
