"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Loader2,
  X,
  CalendarCheck,
  Shuffle,
  ChevronLeft,
  Info,
  AlertTriangle,
  CalendarOff,
  RefreshCw,
  CalendarRange,
} from "lucide-react";
import { formatCHF } from "@/lib/utils";
import { ABO_LABELS, ABO_LAUFZEIT_MONATE, type AboVariante } from "@/lib/abo";
import { FLEX_SURCHARGE_PERCENT, type BookingMode, type Rhythmus } from "@/lib/rhythmus";
import type { AboVorschau } from "@/lib/abo-server";
import type { FixplatzAngebot } from "@/lib/fixplatz-suche";
import { aboAbschliessen, aboVorschau, fixplaetzeSuchen } from "../actions";

type Schritt = "variante" | "rhythmus" | "art" | "platz" | "uebersicht";

function tag(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function Infobox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[#F3F5F8] p-3.5 flex gap-2.5">
      <Info className="w-4 h-4 text-[#1C244B] flex-shrink-0 mt-0.5" />
      <div className="text-sm text-gray-600 leading-snug space-y-1.5">{children}</div>
    </div>
  );
}

function Wahl({
  aktiv,
  titel,
  untertitel,
  erklaerung,
  icon,
  onClick,
}: {
  aktiv: boolean;
  titel: string;
  untertitel: string;
  erklaerung: string;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 transition-all ${
        aktiv
          ? "border-[#1C244B] bg-[#1C244B]/5 shadow-sm"
          : "border-gray-200 hover:border-gray-300 hover:-translate-y-0.5"
      }`}
    >
      <div className="flex items-start gap-3">
        {icon && (
          <span className={`mt-0.5 flex-shrink-0 ${aktiv ? "text-[#1C244B]" : "text-gray-400"}`}>
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-600 text-gray-900">{titel}</p>
            <p className="text-sm font-600 text-[#1C244B] whitespace-nowrap">
              {untertitel}
            </p>
          </div>
          <p className="text-sm text-gray-500 leading-snug mt-1">{erklaerung}</p>
        </div>
        <span
          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${
            aktiv ? "border-[#1C244B] bg-[#1C244B]" : "border-gray-300"
          }`}
        >
          {aktiv && <Check className="w-3 h-3 text-white" />}
        </span>
      </div>
    </button>
  );
}

function Regel({
  id,
  gesetzt,
  onChange,
  titel,
  children,
}: {
  id: string;
  gesetzt: boolean;
  onChange: (v: boolean) => void;
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3.5 transition-colors ${
        gesetzt ? "border-emerald-200 bg-emerald-50/50" : "border-gray-200"
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={gesetzt}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1C244B] focus:ring-[#1C244B] flex-shrink-0"
      />
      <span className="text-sm leading-snug min-w-0">
        <span className="font-600 text-gray-900 block">{titel}</span>
        <span className="text-gray-600">{children}</span>
      </span>
    </label>
  );
}

export default function NeuesAbo({
  canBuy,
  blockedReason,
}: {
  canBuy: boolean;
  blockedReason?: string | null;
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [schritt, setSchritt] = useState<Schritt>("variante");

  const [variante, setVariante] = useState<AboVariante>("halbjahr");
  const [rhythmus, setRhythmus] = useState<Rhythmus>("woechentlich");
  const [bookingMode, setBookingMode] = useState<BookingMode>("fix");
  const [angebote, setAngebote] = useState<FixplatzAngebot[] | null>(null);
  const [platz, setPlatz] = useState<FixplatzAngebot | null>(null);
  const [vorschau, setVorschau] = useState<AboVorschau | null>(null);
  const [autoRenew, setAutoRenew] = useState(true);

  const [regeln, setRegeln] = useState({
    laufzeit: false,
    ferien: false,
    ausfall: false,
    zahlung: false,
    agb: false,
  });

  const [fehler, setFehler] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [ladend, startLaden] = useTransition();

  const alleRegeln = Object.values(regeln).every(Boolean);

  function zuruecksetzen() {
    setSchritt("variante");
    setVariante("halbjahr");
    setRhythmus("woechentlich");
    setBookingMode("fix");
    setAngebote(null);
    setPlatz(null);
    setVorschau(null);
    setAutoRenew(true);
    setRegeln({
      laufzeit: false,
      ferien: false,
      ausfall: false,
      zahlung: false,
      agb: false,
    });
    setFehler(null);
  }

  function schliessen() {
    if (isPending) return;
    setOffen(false);
    zuruecksetzen();
  }

  function plaetzeLaden() {
    setAngebote(null);
    setPlatz(null);
    startLaden(async () => {
      const res = await fixplaetzeSuchen(
        variante === "halbjahr" ? "10er" : "20er",
        rhythmus
      );
      if ("error" in res) {
        setFehler(res.error);
        setAngebote([]);
        return;
      }
      setAngebote(res.angebote);
    });
  }

  function vorschauLaden(weekday: number) {
    setVorschau(null);
    startLaden(async () => {
      const res = await aboVorschau({ variante, rhythmus, bookingMode, weekday });
      if ("error" in res) {
        setFehler(res.error);
        return;
      }
      setVorschau(res.vorschau);
    });
  }

  function weiter() {
    setFehler(null);
    if (schritt === "variante") setSchritt("rhythmus");
    else if (schritt === "rhythmus") setSchritt("art");
    else if (schritt === "art") {
      if (bookingMode === "fix") {
        plaetzeLaden();
        setSchritt("platz");
      } else {
        vorschauLaden(3);
        setSchritt("uebersicht");
      }
    } else if (schritt === "platz" && platz) {
      vorschauLaden(platz.weekday);
      setSchritt("uebersicht");
    }
  }

  function zurueck() {
    setFehler(null);
    if (schritt === "uebersicht") setSchritt(bookingMode === "fix" ? "platz" : "art");
    else if (schritt === "platz") setSchritt("art");
    else if (schritt === "art") setSchritt("rhythmus");
    else if (schritt === "rhythmus") setSchritt("variante");
  }

  function abschliessen() {
    if (!alleRegeln) return;
    setFehler(null);
    startTransition(async () => {
      const res = await aboAbschliessen({
        variante,
        rhythmus,
        bookingMode,
        fixplatz:
          bookingMode === "fix" && platz
            ? { weekday: platz.weekday, time: platz.time, parity: platz.parity }
            : undefined,
        autoRenew,
        regelnBestaetigt: true,
      });
      if (res.error) {
        setFehler(res.error);
        return;
      }
      schliessen();
      router.refresh();
    });
  }

  const weiterMoeglich =
    schritt === "variante" ||
    schritt === "rhythmus" ||
    schritt === "art" ||
    (schritt === "platz" && platz != null);

  if (!canBuy) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm text-gray-500">
          Du hast bereits ein laufendes Abo.
          {blockedReason ? ` ${blockedReason}` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(["halbjahr", "jahr"] as const).map((v) => (
          <button
            key={v}
            onClick={() => {
              zuruecksetzen();
              setVariante(v);
              setSchritt("rhythmus");
              setOffen(true);
            }}
            className="text-left bg-white rounded-2xl border border-gray-100 hover:border-[#1C244B]/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-5 group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1C244B]/10 flex items-center justify-center group-hover:bg-[#1C244B]/15 transition-colors">
                <CalendarRange className="w-5 h-5 text-[#1C244B]" />
              </div>
              <div>
                <p className="font-700 text-gray-900">{ABO_LABELS[v]}</p>
                <p className="text-xs text-gray-500">
                  {ABO_LAUFZEIT_MONATE[v]} Monate
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500 leading-snug">
              {v === "halbjahr"
                ? "Fester Platz, monatliche Zahlung. Guter Einstieg."
                : "Fester Platz für ein ganzes Jahr — günstiger pro Lektion."}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Deinen Monatsbetrag siehst du im nächsten Schritt
            </p>
          </button>
        ))}
      </div>

      {offen && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto"
          onClick={schliessen}
        >
          <div
            className="bg-white rounded-3xl shadow-xl w-full max-w-lg my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3 min-w-0">
                {schritt !== "variante" && schritt !== "rhythmus" && (
                  <button
                    onClick={zurueck}
                    disabled={isPending}
                    className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0"
                    aria-label="Zurück"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <div className="min-w-0">
                  <h3 className="font-700 text-gray-900 truncate">
                    {ABO_LABELS[variante]}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {schritt === "rhythmus" && "Schritt 1 von 3 · Rhythmus"}
                    {schritt === "art" && "Schritt 2 von 3 · Buchungsart"}
                    {schritt === "platz" && "Schritt 3 von 3 · Fester Termin"}
                    {schritt === "uebersicht" && "Übersicht und Bestätigung"}
                  </p>
                </div>
              </div>
              <button
                onClick={schliessen}
                disabled={isPending}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0"
                aria-label="Schliessen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              {schritt === "rhythmus" && (
                <>
                  <Infobox>
                    <p>
                      Wie oft möchtest du Unterricht? Die Laufzeit bleibt gleich —
                      wer jede Woche kommt, bekommt in derselben Zeit doppelt so
                      viele Lektionen und zahlt entsprechend mehr.
                    </p>
                  </Infobox>
                  <div className="space-y-2.5">
                    <Wahl
                      aktiv={rhythmus === "woechentlich"}
                      titel="Jede Woche"
                      untertitel={`${ABO_LAUFZEIT_MONATE[variante]} Monate`}
                      erklaerung="Der übliche Rhythmus. Regelmässiges Üben zwischen den Stunden fällt damit am leichtesten."
                      onClick={() => setRhythmus("woechentlich")}
                    />
                    <Wahl
                      aktiv={rhythmus === "zweiwoechentlich"}
                      titel="Alle zwei Wochen"
                      untertitel={`${ABO_LAUFZEIT_MONATE[variante]} Monate`}
                      erklaerung="Halb so viele Lektionen, halber Monatsbetrag. Sinnvoll, wenn wenig Zeit zum Üben bleibt."
                      onClick={() => setRhythmus("zweiwoechentlich")}
                    />
                  </div>
                </>
              )}

              {schritt === "art" && (
                <>
                  <Infobox>
                    <p>
                      Mit einem <strong>Fixplatz</strong> hast du einen festen
                      Wochentag zur festen Uhrzeit. Alle Termine werden im Voraus
                      eingetragen — du musst nie einzeln buchen.
                    </p>
                    <p>
                      <strong>Flexibel</strong> heisst: du suchst dir jede Lektion
                      selbst aus. Das kostet {FLEX_SURCHARGE_PERCENT} % Aufschlag,
                      weil wechselnde Termine meine Fahrtrouten durcheinanderbringen.
                    </p>
                  </Infobox>
                  <div className="space-y-2.5">
                    <Wahl
                      aktiv={bookingMode === "fix"}
                      icon={<CalendarCheck className="w-5 h-5" />}
                      titel="Fixplatz"
                      untertitel="empfohlen"
                      erklaerung="Fester Tag, feste Zeit, alle Termine im Voraus. Verschieben bleibt jederzeit möglich."
                      onClick={() => setBookingMode("fix")}
                    />
                    <Wahl
                      aktiv={bookingMode === "flex"}
                      icon={<Shuffle className="w-5 h-5" />}
                      titel="Flexibel"
                      untertitel={`+${FLEX_SURCHARGE_PERCENT} %`}
                      erklaerung="Du buchst jede Lektion einzeln, wann es dir passt."
                      onClick={() => setBookingMode("flex")}
                    />
                  </div>
                </>
              )}

              {schritt === "platz" && (
                <>
                  <Infobox>
                    <p>
                      Angeboten werden nur Termine, die über die{" "}
                      <strong>ganze Laufzeit</strong> frei sind.
                    </p>
                  </Infobox>

                  {ladend && (
                    <div className="py-8 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-500 mt-2">
                        Freie Termine werden gesucht…
                      </p>
                    </div>
                  )}

                  {!ladend && angebote && angebote.length === 0 && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-900 leading-snug">
                        Im Moment ist kein Platz über die ganze Laufzeit frei. Wähle
                        „Flexibel“ oder melde dich bei mir.
                      </p>
                    </div>
                  )}

                  {!ladend && angebote && angebote.length > 0 && (
                    <div className="space-y-2">
                      {angebote.slice(0, 12).map((a) => {
                        const aktiv =
                          platz?.weekday === a.weekday &&
                          platz?.time === a.time &&
                          platz?.parity === a.parity;
                        return (
                          <button
                            key={`${a.weekday}-${a.time}-${a.parity}`}
                            type="button"
                            onClick={() => setPlatz(a)}
                            className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                              aktiv
                                ? "border-[#1C244B] bg-[#1C244B]/5"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-600 text-gray-900 text-sm min-w-0">
                                {a.beschreibung}
                              </p>
                              <span
                                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                                  aktiv
                                    ? "border-[#1C244B] bg-[#1C244B]"
                                    : "border-gray-300"
                                }`}
                              >
                                {aktiv && <Check className="w-3 h-3 text-white" />}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {schritt === "uebersicht" && (
                <>
                  {ladend && !vorschau && (
                    <div className="py-8 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-500 mt-2">
                        Deine Termine werden berechnet…
                      </p>
                    </div>
                  )}

                  {vorschau && (
                    <>
                      <div className="rounded-2xl bg-[#1C244B] text-white p-5">
                        <p className="text-xs text-white/60 uppercase tracking-wide">
                          Dein Monatsbetrag
                        </p>
                        <p className="text-3xl font-800 mt-1">
                          {formatCHF(vorschau.monatsbetrag)}
                        </p>
                        <p className="text-sm text-white/70 mt-1">
                          {vorschau.laufzeitMonate} Monate ·{" "}
                          {vorschau.lektionen} Lektionen · gesamt{" "}
                          {formatCHF(vorschau.gesamtpreis)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-gray-50 p-4 space-y-1.5 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500 flex-shrink-0">Laufzeit</span>
                          <span className="font-600 text-gray-900 text-right">
                            {tag(vorschau.periodeStart)} – {tag(vorschau.periodeEnde)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500 flex-shrink-0">Termin</span>
                          <span className="font-600 text-gray-900 text-right">
                            {platz ? platz.beschreibung : "frei wählbar"}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-500 flex-shrink-0">
                            Preis pro Lektion
                          </span>
                          <span className="font-600 text-gray-900 text-right">
                            {formatCHF(vorschau.preisProLektion)}
                          </span>
                        </div>
                      </div>

                      {vorschau.ferientage.length > 0 && (
                        <div className="rounded-2xl border border-gray-100 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <CalendarOff className="w-4 h-4 text-gray-400" />
                            <p className="text-sm font-600 text-gray-900">
                              In den Ferien kein Unterricht
                            </p>
                          </div>
                          <p className="text-sm text-gray-500 leading-snug mb-2">
                            Diese {vorschau.ferientage.length} Termine fallen weg und
                            sind <strong>bereits abgezogen</strong> — du zahlst nichts
                            dafür.
                          </p>
                          <ul className="text-xs text-gray-500 space-y-0.5">
                            {vorschau.ferientage.map((f) => (
                              <li key={f.tag}>
                                {tag(f.tag)} · {f.grund}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <label className="flex items-start gap-2.5 cursor-pointer rounded-2xl border border-gray-100 p-3.5">
                        <input
                          type="checkbox"
                          checked={autoRenew}
                          onChange={(e) => setAutoRenew(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#1C244B] focus:ring-[#1C244B]"
                        />
                        <span className="text-sm text-gray-600 leading-snug">
                          <span className="inline-flex items-center gap-1.5 font-600 text-gray-900">
                            <RefreshCw className="w-3.5 h-3.5" />
                            Automatisch verlängern
                          </span>
                          <br />
                          Am {tag(vorschau.periodeEnde)} geht dein Abo mit demselben
                          Platz weiter. Kündbar bis 30 Tage vorher, jederzeit im
                          Portal.
                        </span>
                      </label>

                      <p className="text-xs font-600 text-gray-500 uppercase tracking-wide pt-1">
                        Bitte einzeln bestätigen
                      </p>

                      <div className="space-y-2">
                        <Regel
                          id="abo-laufzeit"
                          gesetzt={regeln.laufzeit}
                          onChange={(v) => setRegeln((r) => ({ ...r, laufzeit: v }))}
                          titel="Laufzeit"
                        >
                          Mein Abo läuft vom {tag(vorschau.periodeStart)} bis{" "}
                          {tag(vorschau.periodeEnde)} und umfasst{" "}
                          {vorschau.lektionen} Lektionen.
                        </Regel>

                        <Regel
                          id="abo-ferien"
                          gesetzt={regeln.ferien}
                          onChange={(v) => setRegeln((r) => ({ ...r, ferien: v }))}
                          titel="Ferien sind eingerechnet"
                        >
                          In den Schulferien findet kein Unterricht statt. Diese
                          Termine sind in den {vorschau.lektionen} Lektionen bereits
                          abgezogen — es gibt dafür weder Ersatz noch Rückerstattung,
                          weil sie nie berechnet wurden.
                        </Regel>

                        <Regel
                          id="abo-ausfall"
                          gesetzt={regeln.ausfall}
                          onChange={(v) => setRegeln((r) => ({ ...r, ausfall: v }))}
                          titel="Wenn ich einmal nicht kann"
                        >
                          Ich sage spätestens 24 Stunden vorher ab und bekomme dann
                          Ausweichtermine vorgeschlagen. Findet sich keiner,
                          verlängert sich meine Laufzeit entsprechend. Bei einer
                          Absage weniger als 24 Stunden vorher gilt die Lektion als
                          gehalten.
                        </Regel>

                        <Regel
                          id="abo-zahlung"
                          gesetzt={regeln.zahlung}
                          onChange={(v) => setRegeln((r) => ({ ...r, zahlung: v }))}
                          titel="Monatliche Zahlung"
                        >
                          Ich zahle {vorschau.laufzeitMonate} Monate lang je{" "}
                          {formatCHF(vorschau.monatsbetrag)}, insgesamt{" "}
                          {formatCHF(vorschau.gesamtpreis)}. Der Betrag ist jeden
                          Monat gleich, unabhängig davon, wie viele Lektionen in
                          diesen Monat fallen.
                        </Regel>

                        <Regel
                          id="abo-agb"
                          gesetzt={regeln.agb}
                          onChange={(v) => setRegeln((r) => ({ ...r, agb: v }))}
                          titel="AGB"
                        >
                          Ich habe die{" "}
                          <Link
                            href="/agb"
                            target="_blank"
                            className="text-[#1C244B] font-500 underline"
                          >
                            AGB
                          </Link>{" "}
                          gelesen und schliesse dieses Abo verbindlich ab.
                        </Regel>
                      </div>
                    </>
                  )}
                </>
              )}

              {fehler && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {fehler}
                </p>
              )}
            </div>

            <div className="p-5 pt-3 border-t border-gray-100">
              {schritt === "uebersicht" ? (
                <button
                  onClick={abschliessen}
                  disabled={!alleRegeln || !vorschau || isPending}
                  className="w-full flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl min-h-[48px] hover:bg-[#151c3d] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Wird abgeschlossen…
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Abo verbindlich abschliessen
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={weiter}
                  disabled={!weiterMoeglich || ladend}
                  className="w-full flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl min-h-[48px] hover:bg-[#151c3d] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Weiter
                </button>
              )}
              {schritt === "platz" && !platz && !ladend && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  Bitte einen Termin auswählen
                </p>
              )}
              {schritt === "uebersicht" && vorschau && !alleRegeln && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  Bitte alle fünf Punkte bestätigen
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
