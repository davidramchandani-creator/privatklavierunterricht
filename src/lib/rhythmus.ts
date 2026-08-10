// ============================================================
// Rhythmus & Fixplatz — Laufzeit, Wechsel, Serienabstand
//
// Der Rhythmus wird beim Kauf gewählt und bestimmt die Laufzeit:
//   10er wöchentlich       →  4 Monate
//   10er zweiwöchentlich   →  6 Monate
//   20er wöchentlich       →  8 Monate
//   20er zweiwöchentlich   → 12 Monate
//
// Diese vier Werte folgen einer einzigen Regel: pro Lektion 0.4 Monate
// wöchentlich bzw. 0.6 Monate zweiwöchentlich. Das ist kein Zufall, sondern
// bewusst so gewählt — dadurch lässt sich ein Rhythmuswechsel mitten im Paket
// in beide Richtungen fair und ohne Sonderfälle umrechnen: die Restlaufzeit
// richtet sich immer nach den *verbleibenden* Lektionen.
//
// Reine Funktionen, keine DB- oder UI-Abhängigkeit.
// ============================================================

import {
  addTermMonths,
  buildInstalmentPlan,
  roundRappen,
  type InstalmentPlan,
  type SubscriptionType,
} from "./subscription";

export { addTermMonths };

export type Rhythmus = "woechentlich" | "zweiwoechentlich";
export type BookingMode = "fix" | "flex";

export const RHYTHMUS_LABELS: Record<Rhythmus, string> = {
  woechentlich: "wöchentlich",
  zweiwoechentlich: "alle zwei Wochen",
};

export const BOOKING_MODE_LABELS: Record<BookingMode, string> = {
  fix: "Fixplatz",
  flex: "Flexibel",
};

/**
 * Monate Laufzeit pro Lektion. Enthält bereits einen Puffer gegenüber der
 * reinen Unterrichtsdauer (wöchentlich braucht man rechnerisch ~0.23 Monate
 * pro Lektion) — für Ferien, Krankheit und Verschiebungen.
 */
export const MONTHS_PER_LESSON: Record<Rhythmus, number> = {
  woechentlich: 0.4,
  zweiwoechentlich: 0.6,
};

/** Abstand zwischen zwei Lektionen der Fixplatz-Serie, in Tagen. */
export const INTERVAL_DAYS: Record<Rhythmus, number> = {
  woechentlich: 7,
  zweiwoechentlich: 14,
};

/**
 * Aufschlag auf den Lektionspreis für flexible Buchung, in Prozent.
 *
 * Begründung: Flex-Schüler verursachen wechselnde Routen und laufenden
 * Verwaltungsaufwand. Der Aufschlag verrechnet diesen Zeitverlust, statt ihn
 * stillschweigend zu tragen. Fixplatz kostet den normalen Paketpreis.
 */
export const FLEX_SURCHARGE_PERCENT = 10;

export function intervalDaysFor(rhythmus: Rhythmus): number {
  return INTERVAL_DAYS[rhythmus];
}

/**
 * Laufzeit eines Pakets in Monaten, abhängig von Lektionszahl und Rhythmus.
 * Ergibt für die vier Standardfälle exakt 4 / 6 / 8 / 12 Monate.
 */
export function termMonthsFor(lessons: number, rhythmus: Rhythmus): number {
  return Math.round(lessons * MONTHS_PER_LESSON[rhythmus] * 100) / 100;
}

/** Laufzeit für einen Pakettyp (10er/20er) und Rhythmus. */
export function termMonthsForType(
  type: SubscriptionType,
  rhythmus: Rhythmus
): number {
  const lessons = type === "10er" ? 10 : 20;
  return termMonthsFor(lessons, rhythmus);
}

/** Ablaufdatum eines neu gekauften Pakets. */
export function expiryFor(
  lessons: number,
  rhythmus: Rhythmus,
  startDate: string
): string {
  return addTermMonths(startDate, termMonthsFor(lessons, rhythmus));
}

// ── Rhythmuswechsel mitten im Paket ────────────────────────

export type RhythmusChange = {
  von: Rhythmus;
  nach: Rhythmus;
  lessonsRemaining: number;
  /** Neue Restlaufzeit in Monaten, ab heute. */
  restMonate: number;
  /** Neues Ablaufdatum (ISO). */
  neuesAblaufdatum: string;
  /** Differenz zum alten Ablaufdatum in Tagen (negativ = früher). */
  differenzTage: number;
  /** Neuer Serienabstand in Tagen. */
  neuerAbstandTage: number;
  /**
   * true, wenn die Rechnung eine Verkürzung ergeben hätte, das bisherige
   * Ablaufdatum aber geschützt wurde (Wechsel auf den langsameren Rhythmus).
   */
  bisherigesDatumGeschuetzt: boolean;
};

/**
 * Rechnet einen Rhythmuswechsel um — funktioniert in beide Richtungen.
 *
 * Die Restlaufzeit richtet sich nach den *verbleibenden* Lektionen, nicht
 * nach der ursprünglichen Laufzeit. Damit ist der Wechsel in beide
 * Richtungen fair und nicht ausnutzbar:
 *
 *  - wöchentlich → zweiwöchentlich verlängert (man braucht mehr Zeit),
 *    aber nur um das, was die Restlektionen wirklich brauchen. Wer kurz vor
 *    Ablauf mit 1 Restlektion wechselt, gewinnt ~18 Tage, nicht 2 Monate.
 *  - zweiwöchentlich → wöchentlich verkürzt entsprechend. Damit niemand
 *    dadurch Lektionen verliert, wird nie unter die Zeit gekürzt, die für
 *    die Restlektionen im neuen Rhythmus nötig ist.
 *
 * Der Preis ändert sich nicht: gleiche Lektionszahl, gleicher Lektionspreis.
 */
export function computeRhythmusChange(params: {
  von: Rhythmus;
  nach: Rhythmus;
  lessonsRemaining: number;
  /** Heutiges Datum (ISO, Europe/Zurich). */
  today: string;
  /** Bisheriges Ablaufdatum (ISO). */
  bisherigesAblaufdatum: string;
}): RhythmusChange {
  const { von, nach, lessonsRemaining, today, bisherigesAblaufdatum } = params;

  // Mindestens eine Lektion ansetzen, sonst wäre die Restlaufzeit 0 Tage und
  // das Paket im selben Moment abgelaufen.
  const lektionen = Math.max(1, lessonsRemaining);
  const restMonate = Math.round(lektionen * MONTHS_PER_LESSON[nach] * 100) / 100;
  const gerechnet = addTermMonths(today, restMonate);

  // Schutz: Der Wechsel auf den langsameren Rhythmus darf nie Zeit wegnehmen.
  // Sonst entstünde der absurde Fall, dass jemand mit einer Restlektion durch
  // den Wechsel auf zweiwöchentlich 43 Tage *verliert* — er will ja gerade
  // mehr Zeit. Umgekehrt (auf wöchentlich) ist die Verkürzung gewollt: das ist
  // der Gegenwert dafür, dass man den schnelleren Rhythmus wählt.
  const wirdLangsamer =
    MONTHS_PER_LESSON[nach] > MONTHS_PER_LESSON[von];
  const bisherigesDatumGeschuetzt =
    wirdLangsamer && gerechnet < bisherigesAblaufdatum;
  const neuesAblaufdatum = bisherigesDatumGeschuetzt
    ? bisherigesAblaufdatum
    : gerechnet;

  const alt = Date.parse(`${bisherigesAblaufdatum}T00:00:00Z`);
  const neu = Date.parse(`${neuesAblaufdatum}T00:00:00Z`);
  const differenzTage = Math.round((neu - alt) / 86400000);

  return {
    von,
    nach,
    lessonsRemaining,
    restMonate,
    neuesAblaufdatum,
    differenzTage,
    neuerAbstandTage: INTERVAL_DAYS[nach],
    bisherigesDatumGeschuetzt,
  };
}

// ── Preis mit/ohne Flex-Aufschlag ──────────────────────────

/**
 * Lektionspreis inkl. Flex-Aufschlag. Fixplatz zahlt den Grundpreis,
 * Flex den Grundpreis plus Aufschlag.
 */
export function priceWithBookingMode(
  basePricePerLesson: number,
  mode: BookingMode,
  surchargePercent: number = FLEX_SURCHARGE_PERCENT
): number {
  if (mode === "fix") return roundRappen(basePricePerLesson);
  return roundRappen(basePricePerLesson * (1 + surchargePercent / 100));
}

/** Was Flex über die ganze Paketlaufzeit mehr kostet. */
export function flexMehrkosten(
  basePricePerLesson: number,
  lessons: number,
  surchargePercent: number = FLEX_SURCHARGE_PERCENT
): number {
  const fix = priceWithBookingMode(basePricePerLesson, "fix") * lessons;
  const flex =
    priceWithBookingMode(basePricePerLesson, "flex", surchargePercent) * lessons;
  return roundRappen(flex - fix);
}

// ── Ratenplan passend zum Rhythmus ─────────────────────────

/**
 * Ratenplan für ein Paket mit gegebenem Rhythmus.
 *
 * Der Gesamtpreis ist rhythmusunabhängig. Was sich ändert, ist die Laufzeit
 * und damit die Anzahl Raten: zweiwöchentlich läuft länger, also mehr und
 * kleinere Raten. Beispiel 10er zu CHF 700:
 *   wöchentlich      → Anzahlung 175 + 4 × 131.25  (über 4 Monate)
 *   zweiwöchentlich  → Anzahlung 175 + 6 × 87.50   (über 6 Monate)
 */
export function buildPlanForRhythmus(
  type: SubscriptionType,
  totalPrice: number,
  startDate: string,
  rhythmus: Rhythmus
): InstalmentPlan {
  const termMonths = termMonthsForType(type, rhythmus);
  return buildInstalmentPlan(type, totalPrice, startDate, {
    termMonths,
    instalmentCount: Math.round(termMonths),
  });
}

export type OpenInstalment = {
  id: string;
  sequence: number;
  amount: number;
  dueDate: string;
};

export type RescheduledInstalment = OpenInstalment & {
  neuerBetrag: number;
  neuesFaelligkeitsdatum: string;
};

/**
 * Verteilt die noch offenen Raten neu, nachdem sich die Laufzeit geändert hat
 * (Rhythmuswechsel).
 *
 * Grundsatz: **Der Gesamtpreis ändert sich nie.** Bereits bezahlte oder schon
 * gestellte Raten bleiben unangetastet — eine Rechnung, die draussen ist, wird
 * nicht nachträglich umgeschrieben. Nur der noch nicht fakturierte Rest wird
 * gleichmässig über die neue Restlaufzeit gestreckt bzw. gestaucht.
 *
 * Wird die Laufzeit kürzer als die Zahl der offenen Raten, werden Raten
 * zusammengelegt (weniger, dafür grössere). Wird sie länger, bleibt die Zahl
 * der Raten gleich, die Abstände werden grösser — bewusst so: mehr Raten
 * anzulegen als vereinbart wäre eine stille Vertragsänderung.
 */
export function rescheduleOpenInstalments(
  offen: OpenInstalment[],
  neuesAblaufdatum: string,
  today: string
): RescheduledInstalment[] {
  if (offen.length === 0) return [];

  const summe = roundRappen(offen.reduce((s, e) => s + e.amount, 0));

  const ende = Date.parse(`${neuesAblaufdatum}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  const restMonate = Math.max(1, (ende - start) / 86400000 / 30.44);

  // Nie mehr Raten als bisher vereinbart, nie mehr als es Monate gibt.
  const anzahl = Math.max(1, Math.min(offen.length, Math.round(restMonate)));
  const proRate = roundRappen(summe / anzahl);
  const abstandMonate = restMonate / anzahl;

  const sortiert = [...offen].sort((a, b) => a.sequence - b.sequence);
  const ergebnis: RescheduledInstalment[] = [];
  let verteilt = 0;

  for (let i = 0; i < anzahl; i++) {
    const quelle = sortiert[i];
    const istLetzte = i === anzahl - 1;
    // Die letzte Rate nimmt den Rundungsrest auf, damit die Summe exakt bleibt.
    const betrag = istLetzte ? roundRappen(summe - verteilt) : proRate;
    verteilt = roundRappen(verteilt + betrag);
    ergebnis.push({
      ...quelle,
      neuerBetrag: betrag,
      neuesFaelligkeitsdatum: addTermMonths(today, abstandMonate * (i + 1)),
    });
  }

  // Überzählige Raten (Laufzeit wurde kürzer) auf 0 setzen — der Aufrufer
  // storniert sie. Ihr Betrag steckt bereits in den verbleibenden Raten.
  for (let i = anzahl; i < sortiert.length; i++) {
    ergebnis.push({
      ...sortiert[i],
      neuerBetrag: 0,
      neuesFaelligkeitsdatum: sortiert[i].dueDate,
    });
  }

  return ergebnis;
}

// ── Kalenderwochen-Parität (für zweiwöchentliche Fixplätze) ─

/**
 * ISO-Kalenderwoche eines Datums. Wird gebraucht, um zwei zweiwöchentliche
 * Schüler abwechselnd auf denselben Slot zu legen: der eine in geraden, der
 * andere in ungeraden Wochen. Das ist der eigentliche Kapazitätsgewinn —
 * ein Slot trägt zwei Schüler statt anderthalb.
 */
export function isoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  // Donnerstag derselben Woche bestimmt das ISO-Jahr.
  const dayNum = (d.getUTCDay() + 6) % 7; // Mo=0 … So=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

/** 0 = gerade Kalenderwoche, 1 = ungerade. */
export function weekParity(date: Date): 0 | 1 {
  return (isoWeek(date) % 2) as 0 | 1;
}

/**
 * Nächstes Datum ab `from`, das auf den gewünschten Wochentag fällt und –
 * bei zweiwöchentlichem Rhythmus – die gewünschte Wochenparität hat.
 *
 * `weekday` nach JS-Konvention: 0 = Sonntag … 6 = Samstag.
 */
export function nextMatchingDate(
  from: Date,
  weekday: number,
  parity: 0 | 1 | null
): Date {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())
  );
  for (let i = 0; i < 21; i++) {
    const cand = new Date(d.getTime() + i * 86400000);
    if (cand.getUTCDay() !== weekday) continue;
    if (parity === null || weekParity(cand) === parity) return cand;
  }
  // Kann bei gültigem Wochentag nicht eintreten – 21 Tage decken jeden
  // Wochentag in beiden Paritäten ab.
  return d;
}
