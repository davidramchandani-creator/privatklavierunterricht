"use client";

import { useMemo, useState } from "react";
import { FlaskConical, RotateCcw } from "lucide-react";
import {
  planeRouten,
  type PlanEingabe,
  type PlanSchueler,
  type Tagesfenster,
} from "@/lib/routing";
import { formatDauer, schaetzeFahrzeit } from "@/lib/geo";

/**
 * Die Was-wäre-wenn-Werkstatt: Fenster verschieben und sofort sehen, was
 * der Plan daraus macht.
 *
 * Der Planer ist pure Rechnung ohne Datenbank — also läuft er hier direkt
 * im Browser, bei jeder Änderung neu, ohne Server und ohne Speichern.
 * David zieht an einer Zeit („was, wenn Justine ab 17:15 könnte?") und
 * sieht in derselben Sekunde den ganzen Plan, der daraus würde.
 *
 * Zwei bewusste Grenzen:
 *
 * Gerechnet wird mit **geschätzter** Fahrzeit (Luftlinie mal Faktor), nicht
 * mit echten Strassenzeiten wie im grossen Plan oben. Für die Frage „passt
 * es, und ungefähr zu welchem Preis?" reicht das; die Minuten können leicht
 * abweichen.
 *
 * Und: Hier wird **nichts gespeichert**. Was gefällt, trägt David dort ein,
 * wo es wirklich gilt — Schülerzeiten auf der Schülerseite, die eigenen
 * Fenster unter Verfügbarkeit — und rechnet den echten Plan neu.
 */

export type WerkstattEingabe = {
  zuhause: { lat: number; lng: number };
  schueler: PlanSchueler[];
  fenster: Tagesfenster[];
  pufferMinuten: number;
};

type Fenster = { von: string; bis: string } | null;

const TAGNAMEN: Record<number, string> = {
  0: "So",
  1: "Mo",
  2: "Di",
  3: "Mi",
  4: "Do",
  5: "Fr",
  6: "Sa",
};

/** Wählbare Zeiten: 13:00 bis 21:30 im Viertelstundenraster. */
const ZEITEN: string[] = [];
for (let m = 13 * 60; m <= 21 * 60 + 30; m += 15) {
  ZEITEN.push(
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
  );
}

export default function WasWaereWennWerkstatt({
  eingabe,
}: {
  eingabe: WerkstattEingabe;
}) {
  const [offen, setOffen] = useState(false);

  // Bearbeitungszustand: je Schüler, je Wochentag ein Fenster oder null.
  const ausgangslage = useMemo(() => {
    const stand: Record<string, Record<number, Fenster>> = {};
    for (const s of eingabe.schueler) {
      const zeile: Record<number, Fenster> = {};
      for (const t of eingabe.fenster) {
        const f = s.fenster?.find((x) => x.wochentag === t.wochentag);
        zeile[t.wochentag] = f
          ? { von: f.fruehestens.slice(0, 5), bis: f.spaetestens.slice(0, 5) }
          : null;
      }
      stand[s.id] = zeile;
    }
    return stand;
  }, [eingabe]);

  const [stand, setStand] = useState(ausgangslage);
  const geaendert = JSON.stringify(stand) !== JSON.stringify(ausgangslage);

  // Beide Pläne mit derselben (geschätzten) Fahrzeit rechnen — nur so sind
  // die Deltas ehrlich. Der grosse Plan oben nutzt echte Strassenzeiten
  // und wäre als Vergleichsbasis schief.
  const basisPlan = useMemo(
    () =>
      planeRouten({
        ...eingabe,
        fahrzeit: schaetzeFahrzeit,
      } as PlanEingabe),
    [eingabe]
  );

  const versuchsPlan = useMemo(() => {
    const schueler: PlanSchueler[] = eingabe.schueler.map((s) => {
      const zeile = stand[s.id] ?? {};
      const fenster = Object.entries(zeile)
        .filter(([, f]) => f !== null)
        .map(([wt, f]) => ({
          wochentag: Number(wt),
          fruehestens: (f as { von: string }).von,
          spaetestens: (f as { bis: string }).bis,
        }));
      return {
        ...s,
        fenster,
        moeglicheTage: fenster.map((f) => f.wochentag),
      };
    });
    return planeRouten({
      ...eingabe,
      schueler,
      fahrzeit: schaetzeFahrzeit,
    } as PlanEingabe);
  }, [eingabe, stand]);

  const deltaFahrzeit =
    versuchsPlan.fahrzeitProWoche - basisPlan.fahrzeitProWoche;
  const deltaPlaetze = versuchsPlan.positionen - basisPlan.positionen;
  const deltaDraussen =
    versuchsPlan.nichtEingeplant.length - basisPlan.nichtEingeplant.length;

  if (!offen) {
    return (
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setOffen(true)}
          className="flex items-center gap-2 text-sm font-600 text-[#1C244B] hover:underline"
        >
          <FlaskConical className="w-4 h-4 text-violet-600" />
          Was-wäre-wenn-Werkstatt öffnen
        </button>
        <p className="text-xs text-gray-500 mt-1 leading-snug">
          Zeiten einzelner Schüler probeweise verschieben und sofort sehen,
          was der Plan daraus macht — ohne etwas zu speichern.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-violet-200 p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-violet-600" />
            <p className="font-600 text-[#1C244B]">Was-wäre-wenn-Werkstatt</p>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 leading-snug max-w-xl">
            Nur eine Vorschau mit geschätzter Fahrzeit — gespeichert wird
            nichts. Was dir gefällt, trägst du auf der Schülerseite bzw.
            unter Verfügbarkeit ein und rechnest neu. &bdquo;—&ldquo;
            heisst: kann an dem Tag nicht.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {geaendert && (
            <button
              type="button"
              onClick={() => setStand(ausgangslage)}
              className="inline-flex items-center gap-1.5 text-xs font-600 text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <RotateCcw className="w-3 h-3" />
              Zurücksetzen
            </button>
          )}
          <button
            type="button"
            onClick={() => setOffen(false)}
            className="text-xs font-600 text-gray-400 hover:text-gray-600"
          >
            Schliessen
          </button>
        </div>
      </div>

      {/* Regler */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide py-2 pr-3">
                Schüler
              </th>
              {eingabe.fenster.map((t) => (
                <th
                  key={t.wochentag}
                  className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide py-2 px-2"
                >
                  {TAGNAMEN[t.wochentag]}{" "}
                  <span className="font-400 normal-case">
                    {t.beginn}–{t.ende}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {eingabe.schueler.map((s) => (
              <tr key={s.id}>
                <td className="py-2 pr-3 whitespace-nowrap">
                  <span className="font-600 text-gray-900">{s.name}</span>
                  <span className="block text-[11px] text-gray-400">
                    {s.rhythmus === "zweiwoechentlich"
                      ? "alle 2 Wochen"
                      : "jede Woche"}
                  </span>
                </td>
                {eingabe.fenster.map((t) => {
                  const f = stand[s.id]?.[t.wochentag] ?? null;
                  return (
                    <td key={t.wochentag} className="py-2 px-2">
                      {f === null ? (
                        <button
                          type="button"
                          onClick={() =>
                            setStand((v) => ({
                              ...v,
                              [s.id]: {
                                ...v[s.id],
                                [t.wochentag]: {
                                  von: t.beginn,
                                  bis: t.ende,
                                },
                              },
                            }))
                          }
                          className="text-xs text-gray-300 hover:text-[#1C244B] font-600 px-2 py-1 rounded border border-dashed border-gray-200 hover:border-[#1C244B]/40"
                          title="Tag probeweise öffnen"
                        >
                          —
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <select
                            value={f.von}
                            onChange={(e) =>
                              setStand((v) => ({
                                ...v,
                                [s.id]: {
                                  ...v[s.id],
                                  [t.wochentag]: { ...f, von: e.target.value },
                                },
                              }))
                            }
                            className="rounded-lg border border-gray-200 px-1.5 py-1 text-xs bg-white"
                          >
                            {ZEITEN.map((z) => (
                              <option key={z} value={z}>
                                {z}
                              </option>
                            ))}
                          </select>
                          <span className="text-[10px] text-gray-400">–</span>
                          <select
                            value={f.bis}
                            onChange={(e) =>
                              setStand((v) => ({
                                ...v,
                                [s.id]: {
                                  ...v[s.id],
                                  [t.wochentag]: { ...f, bis: e.target.value },
                                },
                              }))
                            }
                            className="rounded-lg border border-gray-200 px-1.5 py-1 text-xs bg-white"
                          >
                            {ZEITEN.map((z) => (
                              <option key={z} value={z}>
                                {z}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setStand((v) => ({
                                ...v,
                                [s.id]: { ...v[s.id], [t.wochentag]: null },
                              }))
                            }
                            className="text-gray-300 hover:text-red-500 text-xs px-1"
                            title="Tag entfernen"
                          >
                            ×
                          </button>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ergebnis */}
      <div
        className={`rounded-xl border p-3 space-y-2 ${
          geaendert
            ? "border-violet-200 bg-violet-50/50"
            : "border-gray-100 bg-[#FAFBFC]"
        }`}
      >
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <p className="text-xs font-600 text-gray-500 uppercase tracking-wide">
            {geaendert ? "So sähe der Plan aus" : "So rechnet die Vorschau den heutigen Stand"}
          </p>
          {geaendert && (
            <p className="text-xs text-gray-600">
              {deltaDraussen !== 0 && (
                <span
                  className={`font-600 mr-3 ${deltaDraussen < 0 ? "text-emerald-700" : "text-red-600"}`}
                >
                  {deltaDraussen < 0 ? "" : "+"}
                  {deltaDraussen} nicht eingeplant
                </span>
              )}
              {deltaPlaetze !== 0 && (
                <span
                  className={`font-600 mr-3 ${deltaPlaetze < 0 ? "text-emerald-700" : "text-gray-600"}`}
                >
                  {deltaPlaetze < 0
                    ? `${-deltaPlaetze} Slot${-deltaPlaetze > 1 ? "s" : ""} frei`
                    : `+${deltaPlaetze} Plätze belegt`}
                </span>
              )}
              <span
                className={`font-600 ${deltaFahrzeit <= 0 ? "text-emerald-700" : "text-amber-700"}`}
              >
                {deltaFahrzeit === 0
                  ? "Fahrzeit unverändert"
                  : `${deltaFahrzeit < 0 ? "−" : "+"}${formatDauer(Math.abs(deltaFahrzeit))} Fahrt/Woche`}
              </span>
            </p>
          )}
        </div>

        {versuchsPlan.tage
          .filter((t) => t.positionen.length > 0)
          .map((t) => (
            <p key={t.wochentag} className="text-sm text-gray-800">
              <span className="font-600">{TAGNAMEN[t.wochentag]}</span>{" "}
              {t.positionen.map((p, i) => {
                const gleich = p.geradeWoche?.id === p.ungeradeWoche?.id;
                const namen = gleich
                  ? p.geradeWoche?.name
                  : [p.geradeWoche?.name, p.ungeradeWoche?.name]
                      .filter(Boolean)
                      .join(" / ");
                return (
                  <span key={i} className="mr-2 whitespace-nowrap">
                    {p.beginn} {namen}
                    {!gleich && (
                      <span className="text-[10px] text-violet-700 font-600">
                        {" "}
                        ⇄
                      </span>
                    )}
                  </span>
                );
              })}
            </p>
          ))}
        {versuchsPlan.nichtEingeplant.length > 0 && (
          <p className="text-sm text-red-600">
            Nicht eingeplant:{" "}
            {versuchsPlan.nichtEingeplant
              .map((n) => n.schueler.name)
              .join(", ")}
          </p>
        )}
        <p className="text-[11px] text-gray-400">
          ⇄ heisst: zwei Schüler teilen sich den Platz im Wechsel. Fahrzeit
          geschätzt: {formatDauer(versuchsPlan.fahrzeitProWoche)}/Woche.
        </p>
      </div>
    </div>
  );
}
