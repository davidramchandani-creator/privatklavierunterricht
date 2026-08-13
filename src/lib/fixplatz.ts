// ============================================================
// Fixplatz, die Terminserie eines Pakets
//
// Ein Fixplatz ist ein fester Wochentag + Uhrzeit über die ganze
// Paketlaufzeit. Die Serie wird beim Kauf einmal komplett erzeugt, nicht
// Lektion für Lektion gebucht. Genau darin liegt der Zeitgewinn: eine
// planbare Route und keine laufende Terminverwaltung.
//
// Reine Funktionen, Kollisionsprüfung und DB-Zugriff liegen in
// fixplatz-server.ts.
// ============================================================

import {
  LESSON_DURATION_MIN,
  isSlotBookable,
  zonedToUtc,
  utcToZonedDate,
  type AvailabilityContext,
  type Slot,
} from "./booking";
import { intervalDaysFor, weekParity, type Rhythmus } from "./rhythmus";

export type FixplatzWunsch = {
  /** 0 = Sonntag … 6 = Samstag (JS-Konvention). */
  weekday: number;
  /** Ortszeit "HH:MM" in Europe/Zurich. */
  time: string;
  rhythmus: Rhythmus;
  /** Anzahl Lektionen im Paket. */
  lessons: number;
};

export const WEEKDAY_LABELS: Record<number, string> = {
  0: "Sonntag",
  1: "Montag",
  2: "Dienstag",
  3: "Mittwoch",
  4: "Donnerstag",
  5: "Freitag",
  6: "Samstag",
};

export const WEEKDAY_SHORT: Record<number, string> = {
  0: "So",
  1: "Mo",
  2: "Di",
  3: "Mi",
  4: "Do",
  5: "Fr",
  6: "Sa",
};

/** Lesbare Beschreibung eines Fixplatzes, z. B. "Dienstags 17:15, wöchentlich". */
export function describeFixplatz(
  weekday: number,
  time: string,
  rhythmus: Rhythmus,
  parity?: 0 | 1 | null
): string {
  const tag = WEEKDAY_LABELS[weekday] ?? "?";
  const hhmm = time.slice(0, 5);
  if (rhythmus === "woechentlich") return `Jeden ${tag} um ${hhmm}`;
  const woche =
    parity == null ? "" : parity === 0 ? " (gerade Wochen)" : " (ungerade Wochen)";
  return `Jeden zweiten ${tag} um ${hhmm}${woche}`;
}

/**
 * Erster Termin der Serie: der nächste passende Wochentag, der weit genug in
 * der Zukunft liegt.
 *
 * `minLeadHours` schützt die 24-Stunden-Regel, ein Fixplatz darf nicht mit
 * einer Lektion morgen früh starten, nur weil heute zufällig der richtige
 * Wochentag ist.
 */
export function firstSeriesStart(
  wunsch: FixplatzWunsch,
  now: Date,
  parity: 0 | 1 | null,
  minLeadHours = 24
): Date {
  const [hh, mm] = wunsch.time.split(":").map(Number);
  const frühestens = now.getTime() + minLeadHours * 3600000;

  // Bis zu 4 Wochen vorausschauen: deckt jeden Wochentag in beiden
  // Paritäten ab, auch wenn der Wunschtag heute schon vorbei ist.
  for (let i = 0; i <= 28; i++) {
    const tag = new Date(now.getTime() + i * 86400000);
    const cal = utcToZonedDate(tag);
    const kandidat = zonedToUtc(cal.y, cal.m, cal.d, hh, mm);

    if (kandidat.getTime() < frühestens) continue;

    // Wochentag in Zürcher Lokalzeit prüfen, nicht in UTC. Bei Abendterminen
    // liegt der UTC-Tag sonst falsch.
    const lokalerWochentag = new Date(
      Date.UTC(cal.y, cal.m - 1, cal.d)
    ).getUTCDay();
    if (lokalerWochentag !== wunsch.weekday) continue;

    if (parity !== null) {
      const kw = weekParity(new Date(Date.UTC(cal.y, cal.m - 1, cal.d)));
      if (kw !== parity) continue;
    }
    return kandidat;
  }

  // Unerreichbar bei gültigem Wochentag, 28 Tage decken alles ab.
  throw new Error(
    `Kein passender Starttermin für ${WEEKDAY_LABELS[wunsch.weekday]} gefunden.`
  );
}

/**
 * Alle Termine der Fixplatz-Serie.
 *
 * Der Abstand wird in Kalendertagen gerechnet und die Uhrzeit anschliessend
 * neu in Zürcher Lokalzeit gesetzt. Dadurch bleibt die Lektion über die
 * Sommerzeitumstellung hinweg auf derselben Uhrzeit, ein reines
 * "+7×86400000 ms" würde im Herbst plötzlich eine Stunde früher landen.
 */
export function fixplatzSeriesStarts(
  wunsch: FixplatzWunsch,
  firstStart: Date
): Date[] {
  const [hh, mm] = wunsch.time.split(":").map(Number);
  const abstand = intervalDaysFor(wunsch.rhythmus);
  const ersterTag = utcToZonedDate(firstStart);
  const basis = Date.UTC(ersterTag.y, ersterTag.m - 1, ersterTag.d);

  const starts: Date[] = [];
  for (let i = 0; i < wunsch.lessons; i++) {
    const tag = new Date(basis + i * abstand * 86400000);
    starts.push(
      zonedToUtc(
        tag.getUTCFullYear(),
        tag.getUTCMonth() + 1,
        tag.getUTCDate(),
        hh,
        mm
      )
    );
  }
  return starts;
}

export type FixplatzSlot = Slot & {
  /** Position in der Serie, 1-basiert. */
  nummer: number;
  /** Ob dieser Termin so buchbar ist. */
  frei: boolean;
};

export type FixplatzPruefung = {
  slots: FixplatzSlot[];
  freie: number;
  belegte: FixplatzSlot[];
  /** Alle Termine frei = Serie sofort buchbar. */
  vollstaendigFrei: boolean;
  /** Letzter Termin der Serie, muss in die Laufzeit passen. */
  letzterTermin: Date | null;
};

/**
 * Prüft die ganze Serie gegen Kollisionen, Abwesenheiten und Zeitblöcke.
 *
 * Anders als bei einer normalen Serienbuchung ist ein einzelner belegter
 * Termin hier **kein Abbruchgrund**. Über 4 bis 12 Monate hinweg liegt fast
 * immer mal eine Ferienwoche oder ein Feiertag im Weg. Diese Lektionen werden
 * markiert und bekommen einen Ausweichtermin, die Serie als Ganzes bleibt
 * bestehen. Ein Abbruch würde bedeuten, dass praktisch niemand je einen
 * Fixplatz buchen könnte.
 */
export function pruefeFixplatzSerie(
  wunsch: FixplatzWunsch,
  firstStart: Date,
  ctx: AvailabilityContext,
  durationMin = LESSON_DURATION_MIN
): FixplatzPruefung {
  const starts = fixplatzSeriesStarts(wunsch, firstStart);
  const slots: FixplatzSlot[] = starts.map((start, i) => {
    const slot: Slot = {
      start,
      end: new Date(start.getTime() + durationMin * 60000),
    };
    return { ...slot, nummer: i + 1, frei: isSlotBookable(slot, ctx) };
  });

  const belegte = slots.filter((s) => !s.frei);
  return {
    slots,
    freie: slots.length - belegte.length,
    belegte,
    vollstaendigFrei: belegte.length === 0,
    letzterTermin: slots.length ? slots[slots.length - 1].start : null,
  };
}

/**
 * Anteil der Serie, der auf Anhieb klappt. Unter diesem Wert lohnt sich der
 * Fixplatz nicht, dann ist der Slot schlicht der falsche.
 */
export const MIN_FREIE_QUOTE = 0.7;

export function fixplatzTauglich(pruefung: FixplatzPruefung): boolean {
  if (pruefung.slots.length === 0) return false;
  return pruefung.freie / pruefung.slots.length >= MIN_FREIE_QUOTE;
}

// ── Ausweichtermine ────────────────────────────────────────

export type AusweichKandidat = {
  slot: Slot;
  /** 1 = gleiche Woche, 2 = Folgewoche. Entspricht der Ausfall-Kaskade. */
  stufe: 1 | 2;
  /** Je kleiner, desto näher am ursprünglichen Termin. */
  rang: number;
  /** Erklärung für die Oberfläche, z. B. "Mittwoch statt Dienstag, gleiche Zeit". */
  begruendung: string;
};

/**
 * Sucht Ausweichtermine für eine ausgefallene Lektion und bringt sie in die
 * Reihenfolge, in der sie angeboten werden sollen.
 *
 * Die Rangfolge bildet die vereinbarte Kaskade ab: zuerst dieselbe Woche,
 * dann die Folgewoche. Innerhalb einer Stufe gewinnt, was dem ursprünglichen
 * Termin am nächsten kommt, gleiche Uhrzeit schlägt gleicher Wochentag,
 * denn die gewohnte Uhrzeit ist für Schüler meist das Verbindlichere.
 *
 * Bewusst **keine** Rückerstattung und keine Gutschrift hier: das sind die
 * Stufen 3 und 4 und werden erst geprüft, wenn diese Liste leer bleibt.
 */
export function ausweichKandidaten(
  originalStart: Date,
  freieSlots: Slot[],
  maxProStufe = 4
): AusweichKandidat[] {
  const original = utcToZonedDate(originalStart);
  const originalTag = Date.UTC(original.y, original.m - 1, original.d);
  const originalWochentag = new Date(originalTag).getUTCDay();
  const originalMinuten =
    originalStart.getTime() - Date.parse(new Date(originalTag).toISOString());

  const kandidaten: AusweichKandidat[] = [];

  for (const slot of freieSlots) {
    // Nur echte Ausweichtermine: der ausgefallene Termin selbst zählt nicht,
    // und rückwärts in die Vergangenheit weichen wir nicht aus.
    if (slot.start.getTime() <= originalStart.getTime()) continue;

    const cal = utcToZonedDate(slot.start);
    const tag = Date.UTC(cal.y, cal.m - 1, cal.d);
    const tageSpaeter = Math.round((tag - originalTag) / 86400000);
    if (tageSpaeter > 14) continue;

    // Gleiche Woche = innerhalb der nächsten 7 Tage, sonst Folgewoche.
    const stufe: 1 | 2 = tageSpaeter <= 7 ? 1 : 2;

    const minuten = slot.start.getTime() - Date.parse(new Date(tag).toISOString());
    const gleicheZeit = Math.abs(minuten - originalMinuten) < 60000;
    const gleicherTag = new Date(tag).getUTCDay() === originalWochentag;

    // Rang: zuerst alle Termine mit der **gewohnten Uhrzeit**, quer über die
    // Wochentage hinweg, erst danach andere Uhrzeiten. Andersherum (nach Datum
    // sortiert) würden vier Vorschläge am selben Tag die Liste füllen und der
    // Schüler sähe gar keine Auswahl an Tagen.
    const rang =
      (gleicheZeit ? 0 : 1000) + tageSpaeter * 10 + (gleicherTag ? 0 : 1);

    const wochentagName = WEEKDAY_LABELS[new Date(tag).getUTCDay()];
    const begruendung = gleicheZeit
      ? gleicherTag
        ? "Gleicher Tag und gleiche Zeit, eine Woche später"
        : `${wochentagName} statt ${WEEKDAY_LABELS[originalWochentag]}, gleiche Zeit`
      : gleicherTag
        ? `${wochentagName} wie gewohnt, andere Uhrzeit`
        : `${wochentagName}, andere Uhrzeit`;

    kandidaten.push({ slot, stufe, rang, begruendung });
  }

  kandidaten.sort((a, b) => a.stufe - b.stufe || a.rang - b.rang);

  // Pro Stufe nur die besten paar zeigen, eine Liste mit 30 Vorschlägen
  // hilft niemandem. Zusätzlich höchstens zwei pro Kalendertag, damit die
  // Auswahl über mehrere Tage streut statt sich auf einem zu stapeln.
  const proStufe = new Map<number, number>();
  const proTag = new Map<string, number>();
  return kandidaten.filter((k) => {
    const tag = k.slot.start.toISOString().slice(0, 10);
    const nTag = (proTag.get(tag) ?? 0) + 1;
    if (nTag > 2) return false;
    const n = (proStufe.get(k.stufe) ?? 0) + 1;
    if (n > maxProStufe) return false;
    proTag.set(tag, nTag);
    proStufe.set(k.stufe, n);
    return true;
  });
}

/**
 * Passt die Serie in die Paketlaufzeit?
 *
 * Bei wöchentlichem Rhythmus brauchen 10 Lektionen gut 2 Monate, die Laufzeit
 * beträgt 4, es bleibt reichlich Luft. Trotzdem geprüft, weil ein sehr
 * später Serienstart (z. B. Kauf kurz vor den Sommerferien) die letzte
 * Lektion hinter das Ablaufdatum schieben könnte.
 */
export function serieInnerhalbLaufzeit(
  letzterTermin: Date | null,
  ablaufdatum: string
): boolean {
  if (!letzterTermin) return true;
  const ablauf = Date.parse(`${ablaufdatum}T23:59:59Z`);
  return letzterTermin.getTime() <= ablauf;
}
