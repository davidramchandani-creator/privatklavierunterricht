"use client";

import { useState, useTransition } from "react";
import {
  Route,
  Loader2,
  MapPin,
  AlertTriangle,
  Car,
  Clock,
  TrendingDown,
  Home,
  Check,
  Info,
  Users,
} from "lucide-react";
import { formatDauer } from "@/lib/geo";
import { WEEKDAY_LABELS, WEEKDAY_SHORT } from "@/lib/fixplatz";
import {
  adressenGeokodieren,
  berechnePlan,
  planSpeichern,
  zuhauseSetzen,
  type PlanErgebnis,
} from "../actions";

/** Kleiner Erklärkasten – überall gleich, damit nichts unerklärt bleibt. */
function Infobox({
  titel,
  children,
}: {
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[#F3F5F8] border border-[#E3E7EE] p-4 flex gap-3">
      <Info className="w-4 h-4 text-[#1C244B] flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-600 text-[#1C244B]">{titel}</p>
        <div className="text-sm text-gray-600 leading-snug mt-1 space-y-1.5">
          {children}
        </div>
      </div>
    </div>
  );
}

function Kennzahl({
  label,
  wert,
  hinweis,
  ton = "normal",
}: {
  label: string;
  wert: string;
  hinweis?: string;
  ton?: "normal" | "gut" | "warnung";
}) {
  const farbe =
    ton === "gut"
      ? "text-emerald-600"
      : ton === "warnung"
        ? "text-amber-600"
        : "text-[#1C244B]";
  return (
    <div className="bg-white rounded-2xl border border-[#EAECEF] p-3.5 sm:p-4">
      <p className="text-xs sm:text-[13px] text-gray-500">{label}</p>
      <p className={`text-lg sm:text-2xl font-700 mt-1 tabular-nums ${farbe}`}>
        {wert}
      </p>
      {hinweis && <p className="text-xs text-gray-400 mt-1 leading-snug">{hinweis}</p>}
    </div>
  );
}

export default function RoutenplanerBoard({
  zuhauseAdresse,
  schuelerGesamt,
  ohneAdresse,
}: {
  zuhauseAdresse: string;
  schuelerGesamt: number;
  ohneAdresse: number;
}) {
  const [ergebnis, setErgebnis] = useState<PlanErgebnis | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [nurFixplatz, setNurFixplatz] = useState(false);
  const [puffer, setPuffer] = useState(15);
  const [adresse, setAdresse] = useState(zuhauseAdresse);
  const [isPending, startTransition] = useTransition();
  const [geoPending, startGeo] = useTransition();

  function rechnen() {
    setFehler(null);
    setMeldung(null);
    startTransition(async () => {
      const res = await berechnePlan({ nurFixplatz, pufferMinuten: puffer });
      if ("error" in res) {
        setFehler(res.error ?? null);
        setErgebnis(null);
        return;
      }
      setErgebnis(res);
    });
  }

  function geokodieren() {
    setFehler(null);
    setMeldung(null);
    startGeo(async () => {
      const res = await adressenGeokodieren();
      if ("error" in res) {
        setFehler(res.error ?? null);
        return;
      }
      const teile = [`${res.erledigt} Adresse(n) aufgelöst`];
      if (res.fehlgeschlagen.length > 0) {
        teile.push(
          `nicht gefunden: ${res.fehlgeschlagen.map((f) => f.name).join(", ")}`
        );
      }
      setMeldung(teile.join(" · "));
    });
  }

  function adresseSpeichern() {
    setFehler(null);
    setMeldung(null);
    startTransition(async () => {
      const res = await zuhauseSetzen(adresse);
      if ("error" in res) {
        setFehler(res.error ?? null);
        return;
      }
      setMeldung("Ausgangspunkt gespeichert.");
    });
  }

  function speichern() {
    if (!ergebnis) return;
    startTransition(async () => {
      const res = await planSpeichern(
        `Wochenplan ${new Date().toLocaleDateString("de-CH")}`,
        ergebnis.plan
      );
      if (res.error) {
        setFehler(res.error);
        return;
      }
      setMeldung("Plan gespeichert.");
    });
  }

  return (
    <div className="space-y-5">
      <Infobox titel="Was dieses Werkzeug macht">
        <p>
          Es verteilt deine Schüler auf Wochentage und Uhrzeiten, sodass möglichst
          wenig Fahrzeit anfällt. Gruppiert wird nach <strong>Fahrtrichtung</strong>,
          nicht nach Luftlinie — Elgg und Wiesendangen liegen auf derselben Strecke
          und gehören darum auf denselben Abend.
        </p>
        <p>
          Zwei Schüler mit zweiwöchentlichem Rhythmus, die nahe beieinander wohnen,
          teilen sich einen Platz: der eine in geraden, der andere in ungeraden
          Kalenderwochen. So trägt ein Platz zwei Schüler.
        </p>
        <p className="text-gray-500">
          Es wird nichts gebucht und nichts verändert. Das Ergebnis ist ein
          Vorschlag zum Anschauen.
        </p>
      </Infobox>

      {/* Ausgangspunkt */}
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-[#1C244B]" />
          <p className="font-600 text-[#1C244B]">Ausgangspunkt</p>
        </div>
        <p className="text-sm text-gray-500 leading-snug">
          Jede Tagesroute beginnt und endet hier. Der Rückweg zählt mit — sonst
          sähe ein weit entfernter letzter Schüler künstlich günstig aus.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="Strasse Nr., PLZ Ort"
            className="flex-1 rounded-xl border border-gray-200 px-3.5 min-h-[44px] text-sm focus:outline-none focus:border-[#1C244B]"
          />
          <button
            onClick={adresseSpeichern}
            disabled={isPending}
            className="text-sm font-600 px-4 min-h-[44px] rounded-xl border border-gray-200 active:bg-gray-50 disabled:opacity-40 whitespace-nowrap"
          >
            Übernehmen
          </button>
        </div>
      </div>

      {/* Adressen */}
      {ohneAdresse > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-600 text-amber-900">
              {ohneAdresse} Schüler ohne Koordinaten
            </p>
            <p className="text-sm text-amber-800 leading-snug mt-0.5">
              Sie können nicht eingeplant werden. Adressen einmal auflösen lassen —
              das dauert etwa eine Sekunde pro Schüler und wird danach gespeichert.
            </p>
            <button
              onClick={geokodieren}
              disabled={geoPending}
              className="mt-2.5 inline-flex items-center gap-2 text-sm font-600 bg-white border border-amber-300 rounded-xl px-3.5 min-h-[40px] active:bg-amber-100 disabled:opacity-40"
            >
              {geoPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Adressen auflösen
            </button>
          </div>
        </div>
      )}

      {/* Einstellungen + Rechnen */}
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5 space-y-4">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={nurFixplatz}
            onChange={(e) => setNurFixplatz(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1C244B] focus:ring-[#1C244B]"
          />
          <span className="text-sm text-gray-600 leading-snug">
            <span className="font-600 text-gray-900">
              Nur Schüler mit Fixplatz einplanen
            </span>
            <br />
            Flex-Schüler buchen selbst und lassen sich nicht fest einplanen. Ohne
            Häkchen werden alle {schuelerGesamt} aktiven Schüler gerechnet — nützlich,
            um zu sehen, was ein Umstieg auf Fixplatz bringen würde.
          </span>
        </label>

        <div>
          <label className="text-sm font-600 text-gray-900">
            Puffer zwischen zwei Lektionen: {puffer} Min.
          </label>
          <p className="text-xs text-gray-500 leading-snug mt-0.5 mb-2">
            Zusätzlich zur reinen Fahrzeit — Verabschieden, Instrument einpacken,
            parkieren. Zu knapp gerechnet stimmt der Plan im Alltag nicht.
          </p>
          <input
            type="range"
            min={0}
            max={30}
            step={5}
            value={puffer}
            onChange={(e) => setPuffer(Number(e.target.value))}
            className="w-full accent-[#1C244B]"
          />
        </div>

        <button
          onClick={rechnen}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl min-h-[48px] hover:bg-[#151c3d] disabled:opacity-40 transition-colors"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Wird gerechnet…
            </>
          ) : (
            <>
              <Route className="w-4 h-4" /> Plan berechnen
            </>
          )}
        </button>
      </div>

      {fehler && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>
      )}
      {meldung && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
          {meldung}
        </p>
      )}

      {ergebnis && <Ergebnisansicht ergebnis={ergebnis} onSpeichern={speichern} />}
    </div>
  );
}

function Ergebnisansicht({
  ergebnis,
  onSpeichern,
}: {
  ergebnis: PlanErgebnis;
  onSpeichern: () => void;
}) {
  const { plan, vergleich, varianten, empfehlung } = ergebnis;
  const genutzteTage = plan.tage.filter((t) => t.positionen.length > 0);

  return (
    <div className="space-y-5">
      {/* Kennzahlen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <Kennzahl
          label="Fahrzeit pro Woche"
          wert={formatDauer(plan.fahrzeitProWoche)}
          hinweis={`über ${genutzteTage.length} Unterrichtstage`}
        />
        <Kennzahl
          label="Fahrzeit je Lektion"
          wert={formatDauer(plan.fahrzeitProLektion)}
          hinweis="die eigentliche Effizienzkennzahl"
          ton={plan.fahrzeitProLektion > 20 * 60 ? "warnung" : "gut"}
        />
        <Kennzahl
          label="Lektionen pro Woche"
          wert={String(plan.lektionenProWoche)}
          hinweis="zweiwöchentliche zählen halb"
        />
        <Kennzahl
          label="Gespart pro Jahr"
          wert={`${vergleich.ersparnisStundenProJahr} Std.`}
          hinweis="gegenüber ungeplanter Verteilung"
          ton="gut"
        />
      </div>

      {/* Wie viele Tage lohnen sich */}
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingDown className="w-4 h-4 text-[#1C244B]" />
          <p className="font-600 text-[#1C244B]">Wie viele Unterrichtstage?</p>
        </div>
        <p className="text-sm text-gray-500 leading-snug mb-4">
          Jeder zusätzliche Tag bringt einen eigenen Hin- und Rückweg mit. Dieselben
          Lektionen auf weniger Abende gelegt kosten darum weniger Fahrzeit — bei
          identischem Umsatz.
        </p>

        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-[#EAECEF]">
                <th className="pb-2 font-500">Tage</th>
                <th className="pb-2 font-500">Wochentage</th>
                <th className="pb-2 font-500 text-right">Lekt./Wo.</th>
                <th className="pb-2 font-500 text-right">Fahrzeit/Wo.</th>
                <th className="pb-2 font-500 text-right">je Lektion</th>
                <th className="pb-2 font-500 text-right">ohne Platz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F3F6]">
              {varianten.map((v) => {
                const istEmpfehlung =
                  empfehlung != null && v.tage === empfehlung.tage;
                return (
                  <tr
                    key={v.tage}
                    className={istEmpfehlung ? "bg-emerald-50/60" : undefined}
                  >
                    <td className="py-2 font-600 text-gray-900">
                      {v.tage}
                      {istEmpfehlung && (
                        <span className="ml-1.5 text-[11px] font-600 text-emerald-700">
                          empfohlen
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-gray-600">
                      {v.wochentage.map((d) => WEEKDAY_SHORT[d]).join(" ")}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-600">
                      {v.lektionenProWoche}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-900 font-600">
                      {formatDauer(v.fahrzeitProWoche)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-600">
                      {formatDauer(v.fahrzeitProLektion)}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        v.nichtEingeplant > 0 ? "text-red-600 font-600" : "text-gray-400"
                      }`}
                    >
                      {v.nichtEingeplant}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {empfehlung && (
          <p className="mt-3 text-sm text-gray-600 leading-snug">
            <strong className="text-[#1C244B]">
              {empfehlung.tage} Tage ({empfehlung.wochentage
                .map((d) => WEEKDAY_LABELS[d])
                .join(", ")})
            </strong>{" "}
            kostet am wenigsten Fahrzeit und bringt trotzdem alle unter.
          </p>
        )}
      </div>

      {/* Tagespläne */}
      <div className="space-y-3">
        {genutzteTage.map((tag) => (
          <div
            key={tag.wochentag}
            className="bg-white rounded-2xl border border-[#EAECEF] overflow-hidden"
          >
            <div className="px-4 sm:px-5 py-3 border-b border-[#EAECEF] flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-700 text-[#1C244B]">{tag.wochentagName}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {tag.positionen.length} Plätze
                </span>
                <span className="inline-flex items-center gap-1">
                  <Car className="w-3 h-3" />
                  {formatDauer(tag.fahrzeitSekunden)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {Math.round(tag.auslastung * 100)} % belegt
                </span>
              </div>
            </div>

            <ul className="divide-y divide-[#F1F3F6]">
              {tag.positionen.map((p, i) => {
                const woechentlich =
                  p.geradeWoche &&
                  p.ungeradeWoche &&
                  p.geradeWoche.id === p.ungeradeWoche.id;
                return (
                  <li key={i} className="px-4 sm:px-5 py-3">
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-700 text-[#1C244B] tabular-nums whitespace-nowrap w-[92px] flex-shrink-0">
                        {p.beginn}–{p.ende}
                      </span>
                      <div className="min-w-0 flex-1">
                        {woechentlich ? (
                          <p className="text-sm font-600 text-gray-900">
                            {p.geradeWoche!.name}
                          </p>
                        ) : (
                          <div className="text-sm space-y-0.5">
                            <p className="text-gray-900">
                              <span className="text-xs text-gray-400 mr-1.5">
                                gerade KW
                              </span>
                              {p.geradeWoche?.name ?? "— frei —"}
                            </p>
                            <p className="text-gray-900">
                              <span className="text-xs text-gray-400 mr-1.5">
                                ungerade KW
                              </span>
                              {p.ungeradeWoche?.name ?? "— frei —"}
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {woechentlich
                            ? "jede Woche"
                            : "abwechselnd, alle zwei Wochen"}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                        <Car className="w-3 h-3" />
                        {formatDauer(p.anfahrtSekunden)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="px-4 sm:px-5 py-2.5 bg-[#FAFBFC] text-xs text-gray-500 flex items-center gap-1.5">
              <Home className="w-3 h-3" />
              Heimweg {formatDauer(tag.heimwegSekunden)}
            </div>

            {tag.warnungen.length > 0 && (
              <div className="px-4 sm:px-5 py-3 bg-amber-50 border-t border-amber-100 space-y-1">
                {tag.warnungen.map((w, i) => (
                  <p
                    key={i}
                    className="text-xs text-amber-900 flex items-start gap-1.5 leading-snug"
                  >
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Nicht eingeplant */}
      {plan.nichtEingeplant.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-red-600" />
            <p className="font-600 text-red-700">
              {plan.nichtEingeplant.length} nicht eingeplant
            </p>
          </div>
          <ul className="space-y-1.5">
            {plan.nichtEingeplant.map((n, i) => (
              <li key={i} className="text-sm text-gray-600">
                <span className="font-600 text-gray-900">{n.schueler.name}</span> —{" "}
                {n.grund}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onSpeichern}
        className="w-full flex items-center justify-center gap-2 text-sm font-600 border border-gray-200 rounded-xl min-h-[44px] active:bg-gray-50"
      >
        <Check className="w-4 h-4" /> Diesen Plan speichern
      </button>
    </div>
  );
}
