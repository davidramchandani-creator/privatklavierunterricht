"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  AUSGABE_KATEGORIEN,
  KATEGORIE_LABELS,
  monatsName,
  type AusgabeKategorie,
  type Monatsabrechnung,
} from "@/lib/abrechnung";
import {
  ausgabeErfassen,
  ausgabeLoeschen,
  jahrAlsCsv,
  monatAbschliessen,
} from "../actions";

function chf(n: number): string {
  return `CHF ${n.toLocaleString("de-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function tag(iso: string): string {
  return new Date(iso).toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
  });
}

/** Monat verschieben, "2026-08" + 1 → "2026-09". */
function verschiebe(monat: string, delta: number): string {
  const [j, m] = monat.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function AbrechnungBoard({
  monat,
  jahr,
  abrechnung,
  jahresMonate,
  erfasst,
}: {
  monat: string;
  jahr: number;
  abrechnung: Monatsabrechnung;
  jahresMonate: Monatsabrechnung[];
  erfasst: boolean;
}) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();
  const [formOffen, setFormOffen] = useState(false);

  const heute = new Date().toISOString().slice(0, 10);
  const [datum, setDatum] = useState(heute);
  const [kategorie, setKategorie] = useState<AusgabeKategorie>("fahrt");
  const [betrag, setBetrag] = useState("");
  const [notiz, setNotiz] = useState("");

  function speichern(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    const fd = new FormData();
    fd.set("datum", datum);
    fd.set("kategorie", kategorie);
    fd.set("betrag", betrag);
    fd.set("notiz", notiz);
    starte(async () => {
      const res = await ausgabeErfassen(fd);
      if ("error" in res && res.error) {
        setFehler(res.error);
        return;
      }
      setBetrag("");
      setNotiz("");
      router.refresh();
    });
  }

  function loeschen(id: string) {
    starte(async () => {
      await ausgabeLoeschen(id);
      router.refresh();
    });
  }

  function abschliessen() {
    starte(async () => {
      await monatAbschliessen(monat, !erfasst);
      router.refresh();
    });
  }

  function exportieren() {
    starte(async () => {
      const res = await jahrAlsCsv(jahr);
      if ("error" in res) {
        setFehler(res.error);
        return;
      }
      // Als Datei anbieten, ohne Umweg über den Server: Der Inhalt ist
      // schon da, ein Download-Endpunkt wäre eine Route mehr zum Absichern.
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.dateiname;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const jahresSumme = jahresMonate.reduce(
    (s, m) => ({
      ein: s.ein + m.einnahmenTotal,
      aus: s.aus + m.ausgabenTotal,
      erg: s.erg + m.ergebnis,
    }),
    { ein: 0, aus: 0, erg: 0 }
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-800 text-[#1C244B]">Abrechnung</h1>
        <button
          onClick={exportieren}
          disabled={laeuft}
          className="flex items-center gap-2 text-sm font-600 text-[#1C244B] px-4 py-2.5 rounded-xl border border-[#1C244B]/20 hover:bg-[#1C244B]/5 transition-colors disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          {jahr} als CSV
        </button>
      </div>

      {/* Monatswahl */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3">
        <button
          onClick={() => router.push(`/admin/abrechnung?monat=${verschiebe(monat, -1)}`)}
          className="p-2 rounded-xl hover:bg-gray-100"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <p className="font-700 text-[#1C244B]">{monatsName(monat)}</p>
        <button
          onClick={() => router.push(`/admin/abrechnung?monat=${verschiebe(monat, 1)}`)}
          className="p-2 rounded-xl hover:bg-gray-100"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-600 text-gray-400 uppercase tracking-wide mb-1">
            Einnahmen
          </p>
          <p className="text-xl font-800 text-emerald-600">
            {chf(abrechnung.einnahmenTotal)}
          </p>
          {abrechnung.einnahmenExtern > 0 && (
            <p className="text-xs text-gray-500 mt-1 leading-snug">
              davon {chf(abrechnung.einnahmenExtern)} extern — aus gehaltenen
              Lektionen gerechnet, bitte mit der Plattform abgleichen
            </p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-600 text-gray-400 uppercase tracking-wide mb-1">
            Ausgaben
          </p>
          <p className="text-xl font-800 text-[#1C244B]">
            {chf(abrechnung.ausgabenTotal)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {abrechnung.ausgaben.length}{" "}
            {abrechnung.ausgaben.length === 1 ? "Posten" : "Posten"}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs font-600 text-gray-400 uppercase tracking-wide mb-1">
            Ergebnis
          </p>
          <p
            className={`text-xl font-800 ${
              abrechnung.ergebnis >= 0 ? "text-[#1C244B]" : "text-red-600"
            }`}
          >
            {chf(abrechnung.ergebnis)}
          </p>
        </div>
      </div>

      {/* Ausgaben */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="text-lg font-700 text-[#1C244B]">Ausgaben</h2>
          <button
            onClick={abschliessen}
            disabled={laeuft}
            className={`text-xs font-600 px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
              erfasst
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {erfasst ? (
              <span className="inline-flex items-center gap-1">
                <Check className="w-3 h-3" /> Monat erledigt
              </span>
            ) : (
              "Als erledigt markieren"
            )}
          </button>
        </div>
        <p className="text-sm text-gray-500 leading-snug mb-4">
          Benzin und Billette, Mittagessen unterwegs, Noten, Weiterbildung.
          Fünf Tage vor Monatsende erinnert dich eine Mail daran.
        </p>

        {/* Nach Kategorie */}
        {abrechnung.ausgabenTotal > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {AUSGABE_KATEGORIEN.filter(
              (k) => abrechnung.ausgabenNachKategorie[k] > 0
            ).map((k) => (
              <span
                key={k}
                className="text-xs px-2.5 py-1 rounded-lg bg-[#F3F5F8] border border-[#E3E7EE] text-[#1C244B]"
              >
                {KATEGORIE_LABELS[k]}{" "}
                <strong>{chf(abrechnung.ausgabenNachKategorie[k])}</strong>
              </span>
            ))}
          </div>
        )}

        {!formOffen ? (
          <button
            onClick={() => setFormOffen(true)}
            className="flex items-center gap-2 text-sm font-600 text-[#1C244B] px-4 py-2.5 rounded-xl border border-[#1C244B]/20 hover:bg-[#1C244B]/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ausgabe erfassen
          </button>
        ) : (
          <form
            onSubmit={speichern}
            className="border border-gray-200 rounded-xl p-4 space-y-3 mb-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1 block">
                <span className="text-xs font-500 text-gray-600">Datum</span>
                <input
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                  className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm"
                  required
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-xs font-500 text-gray-600">Kategorie</span>
                <select
                  value={kategorie}
                  onChange={(e) =>
                    setKategorie(e.target.value as AusgabeKategorie)
                  }
                  className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm bg-white"
                >
                  {AUSGABE_KATEGORIEN.map((k) => (
                    <option key={k} value={k}>
                      {KATEGORIE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 block">
                <span className="text-xs font-500 text-gray-600">Betrag CHF</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={betrag}
                  onChange={(e) => setBetrag(e.target.value)}
                  placeholder="42.50"
                  className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm"
                  required
                />
              </label>
            </div>
            <label className="space-y-1 block">
              <span className="text-xs font-500 text-gray-600">
                Notiz (optional)
              </span>
              <input
                type="text"
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                placeholder="Tanken vor Winterthur-Runde"
                className="w-full h-11 rounded-lg border border-gray-200 px-3 text-sm"
              />
            </label>
            {fehler && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {fehler}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={laeuft}
                className="bg-[#1C244B] text-white font-600 text-sm px-4 py-2 rounded-xl disabled:opacity-40 inline-flex items-center gap-2"
              >
                {laeuft && <Loader2 className="w-3 h-3 animate-spin" />}
                Speichern
              </button>
              <button
                type="button"
                onClick={() => setFormOffen(false)}
                className="text-sm text-gray-500 px-4 py-2"
              >
                Fertig
              </button>
            </div>
          </form>
        )}

        {abrechnung.ausgaben.length > 0 && (
          <ul className="divide-y divide-gray-100 mt-2">
            {abrechnung.ausgaben.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="text-gray-400 tabular-nums">
                      {tag(a.datum)}
                    </span>{" "}
                    {KATEGORIE_LABELS[a.kategorie]}
                    {a.notiz && (
                      <span className="text-gray-500"> · {a.notiz}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-600 text-[#1C244B] tabular-nums">
                    {chf(a.betrag)}
                  </span>
                  <button
                    onClick={() => loeschen(a.id)}
                    disabled={laeuft}
                    className="text-gray-300 hover:text-red-600 disabled:opacity-40"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Einnahmen im Detail */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <h2 className="text-lg font-700 text-[#1C244B]">
            Eingegangene Zahlungen
          </h2>
        </div>
        <p className="text-sm text-gray-500 leading-snug mb-4">
          Gezählt nach Zahlungseingang, nicht nach Lektionsdatum — so wie es
          auf dem Konto stand.
        </p>
        {abrechnung.einnahmen.length === 0 ? (
          <p className="text-sm text-gray-400">
            In diesem Monat ist noch nichts eingegangen.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {abrechnung.einnahmen.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <p className="text-sm text-gray-900 min-w-0 truncate">
                  <span className="text-gray-400 tabular-nums">
                    {tag(e.datum)}
                  </span>{" "}
                  {e.bezeichnung}
                  {e.quelle === "extern" && (
                    <span className="ml-1.5 text-[11px] font-600 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                      gerechnet
                    </span>
                  )}
                </p>
                <span className="text-sm font-600 text-emerald-600 tabular-nums flex-shrink-0">
                  {chf(e.betrag)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Jahresübersicht */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-4 h-4 text-[#1C244B]" />
          <h2 className="text-lg font-700 text-[#1C244B]">{jahr}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-600 text-gray-400 uppercase tracking-wide">
                <th className="text-left py-2">Monat</th>
                <th className="text-right py-2">Einnahmen</th>
                <th className="text-right py-2">Ausgaben</th>
                <th className="text-right py-2">Ergebnis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jahresMonate.map((m) => (
                <tr
                  key={m.monat}
                  className={m.monat === monat ? "bg-[#1C244B]/[0.03]" : ""}
                >
                  <td className="py-2">
                    <button
                      onClick={() =>
                        router.push(`/admin/abrechnung?monat=${m.monat}`)
                      }
                      className="hover:underline text-gray-700"
                    >
                      {monatsName(m.monat).replace(` ${jahr}`, "")}
                    </button>
                  </td>
                  <td className="text-right tabular-nums text-gray-600">
                    {m.einnahmenTotal > 0 ? chf(m.einnahmenTotal) : "—"}
                  </td>
                  <td className="text-right tabular-nums text-gray-600">
                    {m.ausgabenTotal > 0 ? chf(m.ausgabenTotal) : "—"}
                  </td>
                  <td className="text-right tabular-nums font-600 text-[#1C244B]">
                    {m.einnahmenTotal || m.ausgabenTotal ? chf(m.ergebnis) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 font-700 text-[#1C244B]">
                <td className="py-2.5">Total</td>
                <td className="text-right tabular-nums">{chf(jahresSumme.ein)}</td>
                <td className="text-right tabular-nums">{chf(jahresSumme.aus)}</td>
                <td className="text-right tabular-nums">{chf(jahresSumme.erg)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-gray-400 leading-snug mt-3">
          Diese Zahlen sind eine Aufstellung, keine Steuerberatung. Was davon
          abzugsfähig ist und wie du es deklarierst, klärst du mit deinem
          Treuhänder oder der Steuerverwaltung.
        </p>
      </div>
    </div>
  );
}
