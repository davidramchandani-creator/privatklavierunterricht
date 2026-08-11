"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Loader2,
  Info,

  Star,
  Bell,
  AlertTriangle,
  Car,
  Users,
  Play,
} from "lucide-react";
import { formatDauer } from "@/lib/geo";
import { WEEKDAY_LABELS } from "@/lib/fixplatz";
import {
  erinnern,
  rundeSchliessen,
  rundeStarten,
  zuteilungAnwenden,
  zuteilungRechnen,
  type PlanungsAnsicht,
} from "../actions";
import EinpassenKarte from "./EinpassenKarte";

function tag(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function Infobox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#F3F5F8] border border-[#E3E7EE] p-4 flex gap-3">
      <Info className="w-4 h-4 text-[#1C244B] flex-shrink-0 mt-0.5" />
      <div className="text-sm text-gray-600 leading-snug space-y-1.5 min-w-0">
        {children}
      </div>
    </div>
  );
}

export default function PlanungBoard({
  offeneRunde,
}: {
  offeneRunde: { id: string; titel: string; frist: string } | null;
}) {
  const router = useRouter();
  const [ansicht, setAnsicht] = useState<PlanungsAnsicht | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [puffer, setPuffer] = useState(15);
  const [probelauf, setProbelauf] = useState(false);
  const [isPending, startTransition] = useTransition();

  function starten(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFehler(null);
    const daten = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await rundeStarten(daten);
      if (res.error) {
        setFehler(res.error);
        return;
      }
      router.refresh();
    });
  }

  function rechnen() {
    if (!offeneRunde) return;
    setFehler(null);
    setMeldung(null);
    startTransition(async () => {
      const res = await zuteilungRechnen(offeneRunde.id, puffer);
      if ("error" in res) {
        setFehler(res.error);
        return;
      }
      setAnsicht(res);
    });
  }

  function erinnernKlick() {
    if (!offeneRunde) return;
    setFehler(null);
    startTransition(async () => {
      const res = await erinnern(offeneRunde.id);
      if (res.error) {
        setFehler(res.error);
        return;
      }
      if (!("erinnert" in res)) return;
      setMeldung(`${res.erinnert} Erinnerung(en) verschickt.`);
      router.refresh();
    });
  }

  function anwenden() {
    if (!offeneRunde || !ansicht) return;
    if (
      !confirm(
        "Zuteilung anwenden? Bestehende Fixplatz-Termine der betroffenen Schüler werden abgesagt und neu gesetzt."
      )
    )
      return;
    setFehler(null);
    startTransition(async () => {
      const res = await zuteilungAnwenden(offeneRunde.id);
      if (res.error) {
        setFehler(res.error);
        return;
      }
      if (!("gesetzt" in res)) return;
      setMeldung(
        `${res.gesetzt} Fixplätze gesetzt, ${res.uebersprungen} übersprungen.`
      );
      setAnsicht(null);
      router.refresh();
    });
  }

  function schliessen() {
    if (!offeneRunde) return;
    if (!confirm("Runde schliessen, ohne sie anzuwenden?")) return;
    startTransition(async () => {
      await rundeSchliessen(offeneRunde.id);
      router.refresh();
    });
  }

  // ── Keine offene Runde: neue starten ──────────────────────
  if (!offeneRunde) {
    return (
      <div className="space-y-5">
        <Infobox>
          <p>
            <strong>Der Ablauf:</strong> Du startest eine Runde, alle Schüler
            bekommen eine Anfrage und tragen im Portal ein, wann sie können.
            Danach rechnest du die Zuteilung — jeder bekommt einen Termin, den er
            auch kann, bei möglichst wenig Fahrzeit.
          </p>
          <p>
            Das ist der Unterschied zum Selberbuchen: Dort bekommt der Schnellste
            den besten Slot und die Route ist, was übrig bleibt. Hier wird einmal
            über alle zusammen entschieden.
          </p>
          <p className="text-gray-500">
            Für einen Einzelnen brauchst du keine Runde — dafür ist die Karte
            unten da.
          </p>
        </Infobox>

        {/*
          Bewusst auch ohne laufende Runde sichtbar: der häufigste Fall ist
          gerade, dass keine Runde läuft und trotzdem jemand einen Platz
          braucht.
        */}
        <EinpassenKarte puffer={puffer} />

        <form
          onSubmit={starten}
          className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5 space-y-3"
        >
          <p className="font-600 text-[#1C244B]">Neue Runde starten</p>

          <div className="space-y-1">
            <label className="text-xs font-500 text-gray-600">Titel</label>
            <input
              name="titel"
              required
              placeholder="z. B. Planung Halbjahr ab Oktober"
              className="w-full rounded-lg border border-gray-200 px-3.5 min-h-[44px] text-sm focus:outline-none focus:border-[#1C244B]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-500 text-gray-600">
                Antwortfrist
              </label>
              <input
                name="frist"
                type="date"
                required
                className="w-full rounded-lg border border-gray-200 px-3.5 min-h-[44px] text-sm focus:outline-none focus:border-[#1C244B]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-500 text-gray-600">
                Periode beginnt (freiwillig)
              </label>
              <input
                name="periode_start"
                type="date"
                className="w-full rounded-lg border border-gray-200 px-3.5 min-h-[44px] text-sm focus:outline-none focus:border-[#1C244B]"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <input
              type="checkbox"
              name="nur_test"
              checked={probelauf}
              onChange={(e) => setProbelauf(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#1C244B] flex-shrink-0"
            />
            <span className="text-sm text-amber-900 leading-snug min-w-0">
              <strong>Probelauf</strong> — nur Testschüler anschreiben.
              <span className="block text-amber-800 mt-0.5">
                Deine echten Schüler bekommen nichts und werden auch bei
                „Anwenden“ nicht angefasst. Testschüler legst du unter{" "}
                <Link href="/admin/testmodus" className="underline font-600">
                  Testmodus
                </Link>{" "}
                an.
              </span>
            </span>
          </label>

          {fehler && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
              {fehler}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl px-5 min-h-[44px] hover:bg-[#151c3d] disabled:opacity-40"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {probelauf
              ? "Probelauf starten (nur Testschüler)"
              : "Runde starten und alle anschreiben"}
          </button>
        </form>
      </div>
    );
  }

  // ── Laufende Runde ────────────────────────────────────────
  const stand = ansicht?.stand ?? [];
  const geantwortet = stand.filter((s) => s.geantwortet).length;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-700 text-[#1C244B]">{offeneRunde.titel}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Antwortfrist {tag(offeneRunde.frist)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={erinnernKlick}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 text-sm font-600 px-3.5 min-h-[40px] rounded-xl border border-gray-200 active:bg-gray-50 disabled:opacity-40"
            >
              <Bell className="w-3.5 h-3.5" />
              Erinnern
            </button>
            <button
              onClick={schliessen}
              disabled={isPending}
              className="text-sm font-600 px-3.5 min-h-[40px] rounded-xl border border-gray-200 text-gray-500 active:bg-gray-50 disabled:opacity-40"
            >
              Schliessen
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5 space-y-4">
        <div>
          <label className="text-sm font-600 text-gray-900">
            Puffer zwischen zwei Lektionen: {puffer} Min.
          </label>
          <p className="text-xs text-gray-500 leading-snug mt-0.5 mb-2">
            Zusätzlich zur Fahrzeit — Verabschieden, Instrument einpacken,
            parkieren.
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
          className="w-full flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl min-h-[48px] hover:bg-[#151c3d] disabled:opacity-40"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Wird gerechnet…
            </>
          ) : (
            <>
              <CalendarCheck className="w-4 h-4" /> Zuteilung rechnen
            </>
          )}
        </button>
      </div>

      <EinpassenKarte puffer={puffer} />

      {fehler && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>
      )}
      {meldung && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
          {meldung}
        </p>
      )}

      {ansicht && (
        <>
          {/* Kennzahlen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            <Kennzahl
              label="Geantwortet"
              wert={`${geantwortet} / ${stand.length}`}
              hinweis={
                geantwortet < stand.length
                  ? "Fehlende können nicht eingeplant werden"
                  : "alle vollständig"
              }
              ton={geantwortet < stand.length ? "warnung" : "gut"}
            />
            <Kennzahl
              label="Zugeteilt"
              wert={`${ansicht.kontext.ergebnis.zuteilungen.length}`}
              hinweis={`von ${ansicht.kontext.schuelerGesamt} Schülern`}
            />
            <Kennzahl
              label="Fahrzeit pro Woche"
              wert={formatDauer(ansicht.kontext.ergebnis.fahrzeitProWoche)}
            />
            <Kennzahl
              label="Wunschtermin"
              wert={`${ansicht.kontext.ergebnis.wunschErfuellt}`}
              hinweis="haben ihre Lieblingszeit"
              ton="gut"
            />
          </div>

          {/* Was die Einschränkungen kosten */}
          <Infobox>
            <p>
              Mit den angegebenen Verfügbarkeiten:{" "}
              <strong>
                {formatDauer(ansicht.kontext.ergebnis.fahrzeitProWoche)}
              </strong>{" "}
              Fahrzeit pro Woche. Ohne jede Einschränkung wären es{" "}
              <strong>{formatDauer(ansicht.kontext.ohneEinschraenkung)}</strong>.
            </p>
            <p className="text-gray-500">
              Die Differenz ist der Preis dafür, dass jeder wirklich kann. Ist sie
              gross, lohnt es sich, bei einzelnen Schülern um ein zusätzliches
              Zeitfenster zu bitten.
            </p>
          </Infobox>

          {/* Wer zahlt schon, hat aber noch keinen Termin */}
          {ansicht.kontext.wartend.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#1C244B]/30 p-4 sm:p-5">
              <p className="font-600 text-[#1C244B] mb-1">
                {ansicht.kontext.wartend.length} Schüler warten auf einen Termin
              </p>
              <p className="text-sm text-gray-500 leading-snug mb-2.5">
                Sie haben ein laufendes Abo, aber noch keinen festen Platz — sie
                zahlen also bereits. Diese Runde sollte sie unterbringen.
              </p>
              <ul className="space-y-1">
                {ansicht.kontext.wartend.map((w) => (
                  <li key={w.name} className="text-sm text-gray-700">
                    {w.name}
                    {!w.hatZeiten && (
                      <span className="text-xs text-red-600 font-600">
                        {" "}
                        · hat noch keine Zeiten angegeben
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Zuteilung nach Tagen */}
          <Tagesliste ansicht={ansicht} />

          {/* Nicht zugeteilt */}
          {ansicht.kontext.ergebnis.nichtZugeteilt.length > 0 && (
            <div className="bg-white rounded-2xl border border-red-200 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <p className="font-600 text-red-700">
                  {ansicht.kontext.ergebnis.nichtZugeteilt.length} nicht zugeteilt
                </p>
              </div>
              <ul className="space-y-1.5">
                {ansicht.kontext.ergebnis.nichtZugeteilt.map((n, i) => (
                  <li key={i} className="text-sm text-gray-600">
                    <span className="font-600 text-gray-900">
                      {n.schueler.name}
                    </span>{" "}
                    — {n.grund}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Wer noch nicht geantwortet hat */}
          {stand.some((s) => !s.geantwortet) && (
            <div className="bg-white rounded-2xl border border-amber-200 p-4 sm:p-5">
              <p className="font-600 text-amber-900 mb-2">
                Noch keine Antwort von
              </p>
              <ul className="space-y-1">
                {stand
                  .filter((s) => !s.geantwortet)
                  .map((s) => (
                    <li key={s.studentId} className="text-sm text-gray-600">
                      {s.name}
                      {s.erinnertAm && (
                        <span className="text-xs text-gray-400"> · bereits erinnert</span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Bemerkungen der Schüler */}
          {stand.some((s) => s.bemerkung) && (
            <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5">
              <p className="font-600 text-[#1C244B] mb-2">Bemerkungen</p>
              <ul className="space-y-2">
                {stand
                  .filter((s) => s.bemerkung)
                  .map((s) => (
                    <li key={s.studentId} className="text-sm">
                      <span className="font-600 text-gray-900">{s.name}:</span>{" "}
                      <span className="text-gray-600">{s.bemerkung}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <button
            onClick={anwenden}
            disabled={
              isPending || ansicht.kontext.ergebnis.zuteilungen.length === 0
            }
            className="w-full flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl min-h-[48px] hover:bg-[#151c3d] disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Zuteilung anwenden und Termine setzen
          </button>
          <p className="text-xs text-gray-400 text-center leading-snug">
            Setzt bei jedem Schüler den Fixplatz und bucht die Terminserie.
            Bestehende Fixplatz-Termine der betroffenen Schüler werden vorher
            abgesagt. Wer seinen Platz behält, wird übersprungen.
          </p>
        </>
      )}
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
      {hinweis && (
        <p className="text-xs text-gray-400 mt-1 leading-snug">{hinweis}</p>
      )}
    </div>
  );
}

function Tagesliste({ ansicht }: { ansicht: PlanungsAnsicht }) {
  const nachTag = new Map<number, typeof ansicht.kontext.ergebnis.zuteilungen>();
  for (const z of ansicht.kontext.ergebnis.zuteilungen) {
    const liste = nachTag.get(z.wochentag) ?? [];
    liste.push(z);
    nachTag.set(z.wochentag, liste);
  }

  return (
    <div className="space-y-3">
      {[...nachTag.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([wochentag, liste]) => (
          <div
            key={wochentag}
            className="bg-white rounded-2xl border border-[#EAECEF] overflow-hidden"
          >
            <div className="px-4 sm:px-5 py-3 border-b border-[#EAECEF] flex items-baseline justify-between gap-4">
              <p className="font-700 text-[#1C244B]">
                {WEEKDAY_LABELS[wochentag]}
              </p>
              <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                <Users className="w-3 h-3" />
                {liste.length}
              </span>
            </div>
            <ul className="divide-y divide-[#F1F3F6]">
              {liste.map((z) => (
                <li
                  key={z.schuelerId + z.beginn}
                  className="px-4 sm:px-5 py-3 flex items-start gap-3"
                >
                  <span className="text-sm font-700 text-[#1C244B] tabular-nums w-[52px] flex-shrink-0">
                    {z.beginn}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-600 text-gray-900 flex items-center gap-1.5">
                      {z.name}
                      {z.praeferenz >= 3 && (
                        <Star className="w-3 h-3 text-amber-500" />
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {z.paritaet === null
                        ? "jede Woche"
                        : z.paritaet === 0
                          ? "gerade Wochen"
                          : "ungerade Wochen"}
                      {z.unveraendert && " · Platz bleibt"}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                    <Car className="w-3 h-3" />
                    {formatDauer(z.anfahrtSekunden)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}
