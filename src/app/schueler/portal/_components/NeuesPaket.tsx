"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  Check,
  Loader2,
  X,
  CalendarClock,
  RefreshCw,
  CalendarCheck,
  Shuffle,
  ChevronLeft,
  Info,
  AlertTriangle,
} from "lucide-react";
import { formatCHF } from "@/lib/utils";
import { CANCELLATION_NOTICE_DAYS, todayInZurich } from "@/lib/subscription";
import {
  buildPlanForRhythmus,
  expiryFor,
  FLEX_SURCHARGE_PERCENT,
  priceWithBookingMode,
  termMonthsForType,
  type BookingMode,
  type Rhythmus,
} from "@/lib/rhythmus";
import type { FixplatzAngebot } from "@/lib/fixplatz-suche";
import { buyPackage, fixplaetzeSuchen } from "../actions";

type Prices = {
  price_10er: number;
  price_20er: number;
  travel_surcharge: number;
};

type Variant = { type: "10er" | "20er"; label: string; lessons: number };

const VARIANTS: Variant[] = [
  { type: "10er", label: "10er-Paket", lessons: 10 },
  { type: "20er", label: "20er-Paket", lessons: 20 },
];

type BillingMode = "einmalig" | "raten";
type Schritt = "paket" | "rhythmus" | "art" | "platz" | "zahlung" | "bestaetigen";

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Erklärkasten – ruhig, nicht alarmierend. */
function Infobox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[#F3F5F8] p-3.5 flex gap-2.5">
      <Info className="w-4 h-4 text-[#1C244B] flex-shrink-0 mt-0.5" />
      <div className="text-sm text-gray-600 leading-snug space-y-1.5">{children}</div>
    </div>
  );
}

/** Auswahlkachel mit Titel, Untertitel und Erklärung. */
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
          <span
            className={`mt-0.5 flex-shrink-0 ${
              aktiv ? "text-[#1C244B]" : "text-gray-400"
            }`}
          >
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

/** Eine einzeln zu bestätigende Regel. */
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

export default function NeuesPaket({
  prices,
  canBuy,
  blockedReason,
}: {
  prices: Prices;
  canBuy: boolean;
  blockedReason?: string | null;
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [schritt, setSchritt] = useState<Schritt>("paket");

  const [variant, setVariant] = useState<Variant | null>(null);
  const [rhythmus, setRhythmus] = useState<Rhythmus>("woechentlich");
  const [bookingMode, setBookingMode] = useState<BookingMode>("fix");
  const [angebote, setAngebote] = useState<FixplatzAngebot[] | null>(null);
  const [platz, setPlatz] = useState<FixplatzAngebot | null>(null);
  const [billingMode, setBillingMode] = useState<BillingMode>("einmalig");
  const [autoRenew, setAutoRenew] = useState(false);

  // Jede Regel wird einzeln bestätigt – ein Sammelhäkchen liest niemand.
  const [regeln, setRegeln] = useState({
    laufzeit: false,
    ausfall: false,
    zahlung: false,
    agb: false,
  });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [suchePending, startSuche] = useTransition();

  const basisPreis = useMemo(() => {
    if (!variant) return 0;
    const base =
      variant.type === "10er" ? prices.price_10er : prices.price_20er;
    return Number(base) + Number(prices.travel_surcharge);
  }, [variant, prices]);

  const preisProLektion = useMemo(
    () => priceWithBookingMode(basisPreis, bookingMode),
    [basisPreis, bookingMode]
  );

  const gesamt = variant ? preisProLektion * variant.lessons : 0;
  const laufzeit = variant ? termMonthsForType(variant.type, rhythmus) : 0;
  const ablauf = variant
    ? expiryFor(variant.lessons, rhythmus, todayInZurich())
    : "";

  const plan = useMemo(() => {
    if (!variant) return null;
    return buildPlanForRhythmus(variant.type, gesamt, todayInZurich(), rhythmus);
  }, [variant, gesamt, rhythmus]);

  const alleRegeln =
    regeln.laufzeit && regeln.ausfall && regeln.zahlung && regeln.agb;

  function zuruecksetzen() {
    setSchritt("paket");
    setVariant(null);
    setRhythmus("woechentlich");
    setBookingMode("fix");
    setAngebote(null);
    setPlatz(null);
    setBillingMode("einmalig");
    setAutoRenew(false);
    setRegeln({ laufzeit: false, ausfall: false, zahlung: false, agb: false });
    setError(null);
  }

  function schliessen() {
    if (isPending) return;
    setOffen(false);
    zuruecksetzen();
  }

  function plaetzeLaden(v: Variant, r: Rhythmus) {
    setAngebote(null);
    setPlatz(null);
    startSuche(async () => {
      const res = await fixplaetzeSuchen(v.type, r);
      if ("error" in res) {
        setError(res.error);
        setAngebote([]);
        return;
      }
      setAngebote(res.angebote);
    });
  }

  function weiter() {
    setError(null);
    if (schritt === "paket" && variant) setSchritt("rhythmus");
    else if (schritt === "rhythmus") setSchritt("art");
    else if (schritt === "art") {
      if (bookingMode === "fix" && variant) {
        plaetzeLaden(variant, rhythmus);
        setSchritt("platz");
      } else {
        setSchritt("zahlung");
      }
    } else if (schritt === "platz") setSchritt("zahlung");
    else if (schritt === "zahlung") setSchritt("bestaetigen");
  }

  function zurueck() {
    setError(null);
    if (schritt === "bestaetigen") setSchritt("zahlung");
    else if (schritt === "zahlung")
      setSchritt(bookingMode === "fix" ? "platz" : "art");
    else if (schritt === "platz") setSchritt("art");
    else if (schritt === "art") setSchritt("rhythmus");
    else if (schritt === "rhythmus") setSchritt("paket");
  }

  function kaufen() {
    if (!variant || !alleRegeln) return;
    setError(null);
    startTransition(async () => {
      const res = await buyPackage(variant.type, true, {
        billingMode,
        autoRenew,
        rhythmus,
        bookingMode,
        fixplatz:
          bookingMode === "fix" && platz
            ? {
                weekday: platz.weekday,
                time: platz.time,
                parity: platz.parity,
              }
            : undefined,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      schliessen();
      router.refresh();
    });
  }

  const weiterMoeglich =
    (schritt === "paket" && variant != null) ||
    schritt === "rhythmus" ||
    schritt === "art" ||
    (schritt === "platz" && platz != null) ||
    schritt === "zahlung";

  if (!canBuy) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm text-gray-500">
          Ein neues Paket kannst du buchen, sobald dein aktuelles aufgebraucht oder
          abgelaufen ist.
          {blockedReason ? ` ${blockedReason}` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Einstieg */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {VARIANTS.map((v) => {
          const ppl =
            Number(v.type === "10er" ? prices.price_10er : prices.price_20er) +
            Number(prices.travel_surcharge);
          return (
            <button
              key={v.type}
              onClick={() => {
                zuruecksetzen();
                setVariant(v);
                setSchritt("rhythmus");
                setOffen(true);
              }}
              className="text-left bg-white rounded-2xl border border-gray-100 hover:border-[#1C244B]/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-5 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1C244B]/10 flex items-center justify-center group-hover:bg-[#1C244B]/15 transition-colors">
                  <Package className="w-5 h-5 text-[#1C244B]" />
                </div>
                <div>
                  <p className="font-700 text-gray-900">{v.label}</p>
                  <p className="text-xs text-gray-500">{v.lessons} Lektionen</p>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <p className="text-2xl font-800 text-[#1C244B]">
                    {formatCHF(ppl)}
                  </p>
                  <p className="text-xs text-gray-500">pro Lektion mit Fixplatz</p>
                </div>
                <p className="text-sm text-gray-500">
                  Total{" "}
                  <span className="font-600 text-gray-700">
                    {formatCHF(ppl * v.lessons)}
                  </span>
                </p>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Laufzeit je nach Rhythmus · auf Wunsch in Monatsraten
              </p>
            </button>
          );
        })}
      </div>

      {offen && variant && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto"
          onClick={schliessen}
        >
          <div
            className="bg-white rounded-3xl shadow-xl w-full max-w-lg my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Kopf */}
            <div className="flex items-start justify-between p-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-3 min-w-0">
                {schritt !== "paket" && schritt !== "rhythmus" && (
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
                    {variant.label}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {schritt === "rhythmus" && "Schritt 1 von 4 · Rhythmus"}
                    {schritt === "art" && "Schritt 2 von 4 · Buchungsart"}
                    {schritt === "platz" && "Schritt 3 von 4 · Fester Termin"}
                    {schritt === "zahlung" &&
                      `Schritt ${bookingMode === "fix" ? 4 : 3} von 4 · Zahlung`}
                    {schritt === "bestaetigen" && "Letzter Schritt · Bestätigen"}
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
              {/* Schritt: Rhythmus */}
              {schritt === "rhythmus" && (
                <>
                  <Infobox>
                    <p>
                      Wie oft möchtest du Unterricht? Das bestimmt, wie lange dein
                      Paket gültig ist — wer alle zwei Wochen kommt, braucht
                      logischerweise länger für dieselben {variant.lessons}{" "}
                      Lektionen und bekommt entsprechend mehr Zeit.
                    </p>
                    <p className="text-gray-500">
                      Der Preis ist in beiden Fällen identisch.
                    </p>
                  </Infobox>

                  <div className="space-y-2.5">
                    <Wahl
                      aktiv={rhythmus === "woechentlich"}
                      titel="Jede Woche"
                      untertitel={`${termMonthsForType(variant.type, "woechentlich")} Monate`}
                      erklaerung={`${variant.lessons} Lektionen im Wochentakt. Gültig bis ${formatDay(
                        expiryFor(variant.lessons, "woechentlich", todayInZurich())
                      )}.`}
                      onClick={() => setRhythmus("woechentlich")}
                    />
                    <Wahl
                      aktiv={rhythmus === "zweiwoechentlich"}
                      titel="Alle zwei Wochen"
                      untertitel={`${termMonthsForType(variant.type, "zweiwoechentlich")} Monate`}
                      erklaerung={`${variant.lessons} Lektionen im Zweiwochentakt. Gültig bis ${formatDay(
                        expiryFor(
                          variant.lessons,
                          "zweiwoechentlich",
                          todayInZurich()
                        )
                      )}.`}
                      onClick={() => setRhythmus("zweiwoechentlich")}
                    />
                  </div>
                </>
              )}

              {/* Schritt: Buchungsart */}
              {schritt === "art" && (
                <>
                  <Infobox>
                    <p>
                      Mit einem <strong>Fixplatz</strong> hast du einen festen
                      Wochentag zur festen Uhrzeit. Alle Termine werden sofort
                      eingetragen — du musst nie wieder einzeln buchen.
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
                      untertitel={`${formatCHF(priceWithBookingMode(basisPreis, "fix"))} / Lektion`}
                      erklaerung="Fester Tag, feste Zeit, alle Termine im Voraus eingetragen. Verschieben bleibt jederzeit möglich."
                      onClick={() => setBookingMode("fix")}
                    />
                    <Wahl
                      aktiv={bookingMode === "flex"}
                      icon={<Shuffle className="w-5 h-5" />}
                      titel="Flexibel"
                      untertitel={`${formatCHF(priceWithBookingMode(basisPreis, "flex"))} / Lektion`}
                      erklaerung={`Du buchst jede Lektion einzeln, wann es dir passt. Insgesamt ${formatCHF(
                        priceWithBookingMode(basisPreis, "flex") * variant.lessons -
                          priceWithBookingMode(basisPreis, "fix") * variant.lessons
                      )} mehr.`}
                      onClick={() => setBookingMode("flex")}
                    />
                  </div>
                </>
              )}

              {/* Schritt: Fixplatz wählen */}
              {schritt === "platz" && (
                <>
                  <Infobox>
                    <p>
                      Hier siehst du nur Termine, die über die <strong>ganze
                      Laufzeit</strong> frei sind — nicht bloss nächste Woche.
                    </p>
                    <p className="text-gray-500">
                      Fällt einzelne Male ein Termin auf Ferien oder einen
                      Feiertag, bekommst du dafür automatisch einen Ausweichtermin.
                    </p>
                  </Infobox>

                  {suchePending && (
                    <div className="py-8 text-center">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
                      <p className="text-sm text-gray-500 mt-2">
                        Freie Termine werden gesucht…
                      </p>
                    </div>
                  )}

                  {!suchePending && angebote && angebote.length === 0 && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-900 leading-snug">
                        Im Moment ist kein Platz über die ganze Laufzeit frei. Wähle
                        „Flexibel“ oder melde dich bei mir — oft findet sich doch
                        etwas.
                      </p>
                    </div>
                  )}

                  {!suchePending && angebote && angebote.length > 0 && (
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
                              <div className="min-w-0">
                                <p className="font-600 text-gray-900 text-sm">
                                  {a.beschreibung}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Erste Lektion {formatDateTime(a.ersterTermin)}
                                </p>
                                {a.belegteTage.length > 0 && (
                                  <p className="text-xs text-amber-700 mt-0.5">
                                    {a.belegteTage.length} Termin
                                    {a.belegteTage.length === 1 ? "" : "e"} brauchen
                                    einen Ausweichtermin
                                  </p>
                                )}
                              </div>
                              <span
                                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 ${
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

              {/* Schritt: Zahlung */}
              {schritt === "zahlung" && plan && (
                <>
                  <Infobox>
                    <p>
                      Du kannst alles auf einmal zahlen oder in Monatsraten. Der
                      Gesamtpreis ist in beiden Fällen gleich —{" "}
                      {formatCHF(gesamt)}.
                    </p>
                  </Infobox>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBillingMode("einmalig")}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        billingMode === "einmalig"
                          ? "border-[#1C244B] bg-[#1C244B]/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className="text-sm font-600 text-gray-900">Einmalig</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatCHF(gesamt)} innert 15 Tagen
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingMode("raten")}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                        billingMode === "raten"
                          ? "border-[#1C244B] bg-[#1C244B]/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <p className="text-sm font-600 text-gray-900">Monatsraten</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {plan.instalmentCount} × {formatCHF(plan.instalmentAmount)}
                      </p>
                    </button>
                  </div>

                  {billingMode === "raten" && (
                    <div className="rounded-2xl border border-gray-100 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-600 text-gray-500 uppercase tracking-wide">
                        <CalendarClock className="w-3.5 h-3.5" />
                        Zahlungsplan
                      </div>
                      <ul className="text-sm divide-y divide-gray-100">
                        {plan.entries.map((e) => (
                          <li key={e.sequence} className="flex justify-between py-1.5">
                            <span className="text-gray-600">
                              {e.kind === "anzahlung"
                                ? "Anzahlung (25 %)"
                                : `Rate ${e.sequence}`}
                              <span className="text-gray-400 ml-2 text-xs">
                                {formatDay(e.dueDate)}
                              </span>
                            </span>
                            <span className="font-600 text-gray-900">
                              {formatCHF(e.amount)}
                            </span>
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
                      Am {formatDay(ablauf)} startet automatisch ein neues{" "}
                      {variant.label}
                      {bookingMode === "fix" ? " mit demselben festen Platz" : ""}.
                      Kündbar bis {CANCELLATION_NOTICE_DAYS} Tage vorher, jederzeit
                      im Portal.
                    </span>
                  </label>
                </>
              )}

              {/* Schritt: Bestätigen */}
              {schritt === "bestaetigen" && plan && (
                <>
                  <div className="rounded-2xl bg-gray-50 p-4 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Paket</span>
                      <span className="font-600 text-gray-900">
                        {variant.label} · {variant.lessons} Lektionen
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Rhythmus</span>
                      <span className="font-600 text-gray-900">
                        {rhythmus === "woechentlich"
                          ? "jede Woche"
                          : "alle zwei Wochen"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500 flex-shrink-0">Termin</span>
                      <span className="font-600 text-gray-900 text-right">
                        {bookingMode === "fix" && platz
                          ? platz.beschreibung
                          : "frei wählbar"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Laufzeit</span>
                      <span className="font-600 text-gray-900">
                        {laufzeit} Monate, bis {formatDay(ablauf)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                      <span className="text-gray-500">Gesamtpreis</span>
                      <span className="font-800 text-[#1C244B]">
                        {formatCHF(gesamt)}
                      </span>
                    </div>
                    {billingMode === "raten" && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Jetzt fällig</span>
                        <span className="text-gray-500">
                          {formatCHF(plan.depositAmount)} Anzahlung
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs font-600 text-gray-500 uppercase tracking-wide pt-1">
                    Bitte einzeln bestätigen
                  </p>

                  <div className="space-y-2">
                    <Regel
                      id="regel-laufzeit"
                      gesetzt={regeln.laufzeit}
                      onChange={(v) => setRegeln((r) => ({ ...r, laufzeit: v }))}
                      titel="Laufzeit und Verfall"
                    >
                      Meine {variant.lessons} Lektionen sind bis zum{" "}
                      {formatDay(ablauf)} zu beziehen. Danach verfallen nicht
                      bezogene Lektionen. Bei Abwesenheiten oder ausgefallenen
                      Lektionen verlängert sich die Laufzeit entsprechend.
                    </Regel>

                    <Regel
                      id="regel-ausfall"
                      gesetzt={regeln.ausfall}
                      onChange={(v) => setRegeln((r) => ({ ...r, ausfall: v }))}
                      titel="Wenn ich einmal nicht kann"
                    >
                      Ich sage spätestens 24 Stunden vorher ab und bekomme dann
                      Ausweichtermine vorgeschlagen — zuerst in derselben, sonst in
                      der folgenden Woche. Findet sich keiner, verlängert sich
                      stattdessen meine Laufzeit. Bei einer Absage weniger als 24
                      Stunden vorher gilt die Lektion als gehalten.
                    </Regel>

                    <Regel
                      id="regel-zahlung"
                      gesetzt={regeln.zahlung}
                      onChange={(v) => setRegeln((r) => ({ ...r, zahlung: v }))}
                      titel={
                        billingMode === "raten"
                          ? "Ratenzahlung"
                          : "Zahlung innert 15 Tagen"
                      }
                    >
                      {billingMode === "raten" ? (
                        <>
                          Ich zahle {formatCHF(plan.depositAmount)} Anzahlung und
                          danach {plan.instalmentCount} Monatsraten à{" "}
                          {formatCHF(plan.instalmentAmount)}. Der Gesamtbetrag von{" "}
                          {formatCHF(gesamt)} ist unabhängig davon geschuldet, wie
                          viele Lektionen ich tatsächlich beziehe.
                        </>
                      ) : (
                        <>
                          Ich zahle {formatCHF(gesamt)} innert 15 Tagen nach
                          Rechnungserhalt. Buchen kann ich sofort, ohne auf den
                          Zahlungseingang zu warten.
                        </>
                      )}
                    </Regel>

                    <Regel
                      id="regel-agb"
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
                      gelesen und buche dieses Paket verbindlich.
                    </Regel>
                  </div>
                </>
              )}

              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            {/* Fuss */}
            <div className="p-5 pt-3 border-t border-gray-100">
              {schritt === "bestaetigen" ? (
                <button
                  onClick={kaufen}
                  disabled={!alleRegeln || isPending}
                  className="w-full flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl min-h-[48px] hover:bg-[#151c3d] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Wird gebucht…
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      {billingMode === "raten"
                        ? `Verbindlich buchen – ${formatCHF(plan?.depositAmount ?? 0)} jetzt`
                        : "Verbindlich buchen"}
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={weiter}
                  disabled={!weiterMoeglich || suchePending}
                  className="w-full flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl min-h-[48px] hover:bg-[#151c3d] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Weiter
                </button>
              )}
              {schritt === "platz" && !platz && !suchePending && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  Bitte einen Termin auswählen
                </p>
              )}
              {schritt === "bestaetigen" && !alleRegeln && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  Bitte alle vier Punkte bestätigen
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
