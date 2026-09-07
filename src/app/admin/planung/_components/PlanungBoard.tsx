"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Loader2,
  Info,

  Bell,
} from "lucide-react";
import { ZeitfensterListe } from "@/components/ui/zeitfenster-liste";
import {
  erinnern,
  rundeSchliessen,
  rundeStarten,
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
  antwortStand = [],
}: {
  offeneRunde: {
    id: string;
    titel: string;
    frist: string;
    art?: "termine" | "umstellung";
    startDatum?: string | null;
  } | null;
  /** Wer hat geantwortet und was gewählt — sichtbar ohne erst zu rechnen. */
  antwortStand?: {
    studentId: string;
    name: string;
    geantwortet: boolean;
    aboVariante: "halbjahr" | "jahr" | null;
    aboRhythmus: string | null;
    fenster: {
      wochentag: number;
      von: string;
      bis: string;
      praeferenz: number;
    }[];
  }[];
}) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [probelauf, setProbelauf] = useState(false);
  const [umstellung, setUmstellung] = useState(false);
  const [isPending, startTransition] = useTransition();

  const laufendeUmstellung = offeneRunde?.art === "umstellung";
  // Puffer fuer die Einpassen-Karte. Der Regler dazu hing am alten Planer.
  const puffer = 15;

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
            Danach rechnest du die Zuteilung, jeder bekommt einen Termin, den er
            auch kann, bei möglichst wenig Fahrzeit.
          </p>
          <p>
            Das ist der Unterschied zum Selberbuchen: Dort bekommt der Schnellste
            den besten Slot und die Route ist, was übrig bleibt. Hier wird einmal
            über alle zusammen entschieden.
          </p>
          <p className="text-gray-500">
            Für einen Einzelnen brauchst du keine Runde, dafür ist die Karte
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

          <input type="hidden" name="art" value={umstellung ? "umstellung" : "termine"} />

          <div className="grid grid-cols-2 gap-2.5">
            {[
              {
                wert: false,
                titel: "Nur Termine",
                text: "Zeiten abfragen und zuteilen. Für Schüler, die schon ein Abo haben.",
              },
              {
                wert: true,
                titel: "Umstellung aufs Abo",
                text: "Sie wählen zusätzlich ihr Abo. Beim Anwenden entstehen die Abos.",
              },
            ].map((o) => (
              <button
                key={String(o.wert)}
                type="button"
                onClick={() => setUmstellung(o.wert)}
                className={`text-left rounded-xl border p-3.5 transition-colors ${
                  umstellung === o.wert
                    ? "border-[#1C244B] bg-[#1C244B]/[0.04]"
                    : "border-gray-200"
                }`}
              >
                <span className="block font-600 text-sm text-gray-900">
                  {o.titel}
                </span>
                <span className="block text-xs text-gray-500 mt-1 leading-snug">
                  {o.text}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-500 text-gray-600">Titel</label>
            <input
              name="titel"
              required
              defaultValue=""
              placeholder={
                umstellung
                  ? "z. B. Umstellung auf Abo ab 14. September"
                  : "z. B. Planung Halbjahr ab Oktober"
              }
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
                {umstellung ? "Abos beginnen am" : "Periode beginnt (freiwillig)"}
              </label>
              <input
                name={umstellung ? "start_datum" : "periode_start"}
                type="date"
                required={umstellung}
                className="w-full rounded-lg border border-gray-200 px-3.5 min-h-[44px] text-sm focus:outline-none focus:border-[#1C244B]"
              />
            </div>
          </div>

          {umstellung && (
            <Infobox>
              <p>
                Die Schüler bekommen eine Info-Mail mit der Begründung und
                wählen im Portal Abo, Rhythmus und ihre Zeiten. Sie sehen dabei
                sofort Lektionszahl und Monatsbeitrag.
              </p>
              <p>
                Es passiert <strong>nichts automatisch</strong>. Nach der Frist
                rechnest du die Zuteilung, prüfst den Stundenplan und drückst
                erst dann auf Anwenden. Dabei werden die alten Pakete beendet,
                die Abos angelegt und alle Termine gebucht.
              </p>
            </Infobox>
          )}

          <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <input
              type="checkbox"
              name="nur_test"
              checked={probelauf}
              onChange={(e) => setProbelauf(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#1C244B] flex-shrink-0"
            />
            <span className="text-sm text-amber-900 leading-snug min-w-0">
              <strong>Probelauf</strong>, nur Testschüler anschreiben.
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

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-700 text-[#1C244B]">{offeneRunde.titel}</p>
              {laufendeUmstellung && (
                <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-[#1C244B]/10 text-[#1C244B]">
                  Umstellung
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Antwortfrist {tag(offeneRunde.frist)}
              {laufendeUmstellung && offeneRunde.startDatum
                ? ` · Abos ab ${tag(offeneRunde.startDatum)}`
                : ""}
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

      {/*
        Hier stand der zweite Planer: eigener Algorithmus, eigener Rechnen-
        Knopf, eigenes Ergebnis. Er wusste nichts von Paarung, Wochenausgleich
        und Verdichtung, und zeigte Externe wöchentlich, weil er ihren
        Rhythmus nicht las. Zwei Antworten auf einem Bildschirm, und die
        schlechtere sah nach der verbindlichen aus.

        Gerechnet wird jetzt nur noch im Routenplaner. Die Werkbank oben
        übernimmt den Plan und gibt pro Schüler frei.
      */}
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5">
        <p className="font-600 text-[#1C244B]">Plätze verteilen</p>
        <p className="text-sm text-gray-500 leading-snug mt-1">
          Der Plan wird im Routenplaner gerechnet, dort lässt sich schieben
          und vergleichen. &bdquo;Als Zuteilung übernehmen&ldquo; bringt ihn hierher.
        </p>
        <a
          href="/admin/routenplanung"
          className="mt-3 inline-flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl px-4 min-h-[44px] hover:bg-[#151c3d] transition-colors"
        >
          <CalendarCheck className="w-4 h-4" /> Zum Routenplaner
        </a>
      </div>

      {/* Antwortstand, sofort und ohne Rechnen. Sonst sieht die Runde nach
          dem Start tot aus, obwohl längst Antworten da sind. */}
      {antwortStand.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#EAECEF] p-4 sm:p-5">
          <p className="font-600 text-[#1C244B] mb-3">
            Antworten:{" "}
            {antwortStand.filter((s) => s.geantwortet).length} von{" "}
            {antwortStand.length}
          </p>
          <ul className="space-y-3">
            {antwortStand.map((s) => (
              <li key={s.studentId} className="text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span
                    className={`font-600 ${s.geantwortet ? "text-gray-900" : "text-gray-400"}`}
                  >
                    {s.name}
                  </span>
                  {s.geantwortet ? (
                    s.aboVariante && (
                      <span className="text-gray-600">
                        {s.aboVariante === "jahr" ? "Jahresabo" : "Halbjahresabo"}
                        {" · "}
                        {s.aboRhythmus === "zweiwoechentlich"
                          ? "alle zwei Wochen"
                          : "jede Woche"}
                      </span>
                    )
                  ) : (
                    <span className="text-amber-600 text-xs font-600">
                      noch keine Antwort
                    </span>
                  )}
                </div>

                {/* Die konkreten Zeiten, mit Präferenz. Geteilte Komponente,
                    damit Stern und Graustufe überall dasselbe bedeuten. */}
                {s.fenster.length > 0 && (
                  <div className="mt-1.5">
                    <ZeitfensterListe fenster={s.fenster} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <EinpassenKarte puffer={puffer} />

      {fehler && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>
      )}
      {meldung && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
          {meldung}
        </p>
      )}

    </div>
  );
}
