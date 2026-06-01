// ============================================================
// Buchungs-Engine (Meilenstein 4) – reine Server-Logik
//
// Geschäftsregeln (Spec §4), systemweit gültig:
//  - Lektionsdauer: 45 Min.
//  - Raster: 15 Min.
//  - Verfügbarkeit (Zürich-Lokalzeit):
//      Mo–Do 16:30–20:30, Fr 16:30–18:00, Sa/So keine Termine.
//  - Pufferzeit pro Schüler (15 oder 30 Min), vor UND nach jedem Termin.
//  - 24-Stunden-Regel: Buchung min. 24h im Voraus.
//  - Kollisionsprüfung gegen bestehende Termine (inkl. Puffer),
//    Admin-/Schüler-Abwesenheiten, Zeitblöcke und Wiederholungsregeln.
//  - Serien: lessons_count ∈ {1,5,10}, interval_days ∈ {7,14}.
//
// Alle Zeitberechnungen in Europe/Zurich. Intern wird mit UTC-Instants
// (Date) gerechnet; die Konvertierung von Zürcher Wandzeit erfolgt an den
// Rändern über Intl (DST-korrekt für Abendtermine).
// ============================================================

export const LESSON_DURATION_MIN = 45;
export const SLOT_GRID_MIN = 15;
export const DEFAULT_BUFFER_MIN = 15;
export const BOOKING_LEAD_HOURS = 24;
export const TIMEZONE = "Europe/Zurich";

export const SERIES_LESSON_COUNTS = [1, 5, 10] as const;
export const SERIES_INTERVALS = [7, 14] as const;

// Verfügbare Zeitfenster je Wochentag (JS getUTCDay: 0=So … 6=Sa), Lokalzeit.
export const AVAILABILITY: Record<number, { start: string; end: string }[]> = {
  1: [{ start: "16:30", end: "20:30" }], // Montag
  2: [{ start: "16:30", end: "20:30" }], // Dienstag
  3: [{ start: "16:30", end: "20:30" }], // Mittwoch
  4: [{ start: "16:30", end: "20:30" }], // Donnerstag
  5: [{ start: "16:30", end: "18:00" }], // Freitag
};

export type CalDate = { y: number; m: number; d: number }; // m: 1–12

export type ExistingAppointment = {
  start_at: string | Date;
  end_at: string | Date;
  /** Puffer des zugehörigen Schülers (Min.); Default greift sonst. */
  bufferMinutes?: number;
};

export type Absence = {
  scope: "admin" | "student";
  student_id: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
};

export type TimeBlock = {
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM[:SS]
  end_time: string;
};

export type TimeBlockRule = {
  start_date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string;
  interval_days: number;
};

export type Slot = { start: Date; end: Date };

// ── Zeitzonen-Helfer ───────────────────────────────────────

/** Offset (ms), um den die Zone zur gegebenen Instant vor UTC liegt. */
export function tzOffsetMs(instant: Date, timeZone = TIMEZONE): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = Number(p.value);
  const asUTC = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour,
    map.minute,
    map.second
  );
  return asUTC - instant.getTime();
}

/** Zürcher Wandzeit → UTC-Instant. */
export function zonedToUtc(
  y: number,
  m: number, // 1–12
  d: number,
  hh: number,
  mm: number,
  timeZone = TIMEZONE
): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  // Eine Korrektur reicht ausserhalb der DST-Umstellungsstunde.
  return new Date(guess - offset);
}

/** UTC-Instant → Zürcher Kalenderdatum. */
export function utcToZonedDate(instant: Date, timeZone = TIMEZONE): CalDate {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const p of dtf.formatToParts(instant))
    if (p.type !== "literal") map[p.type] = Number(p.value);
  return { y: map.year, m: map.month, d: map.day };
}

function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map(Number);
  return { h, m: m ?? 0 };
}

function minutesOf(s: string): number {
  const { h, m } = parseHHMM(s);
  return h * 60 + m;
}

/** Wochentag (0=So … 6=Sa) eines Kalenderdatums. */
export function weekdayOf({ y, m, d }: CalDate): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Kalenderdatum um n Tage verschieben. */
export function addDaysCal({ y, m, d }: CalDate, n: number): CalDate {
  const t = Date.UTC(y, m - 1, d) + n * 86400000;
  const dt = new Date(t);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function calToString({ y, m, d }: CalDate): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDateStr(s: string): CalDate {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

function daysBetween(a: CalDate, b: CalDate): number {
  const ta = Date.UTC(a.y, a.m - 1, a.d);
  const tb = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((tb - ta) / 86400000);
}

// ── Slot-Erzeugung ─────────────────────────────────────────

/** Kandidaten-Slots (45 Min, 15-Min-Raster) für ein Kalenderdatum. */
export function generateDaySlots(date: CalDate): Slot[] {
  const windows = AVAILABILITY[weekdayOf(date)] ?? [];
  const slots: Slot[] = [];

  for (const w of windows) {
    const startMin = minutesOf(w.start);
    const endMin = minutesOf(w.end);
    for (
      let s = startMin;
      s + LESSON_DURATION_MIN <= endMin;
      s += SLOT_GRID_MIN
    ) {
      const start = zonedToUtc(date.y, date.m, date.d, Math.floor(s / 60), s % 60);
      const end = new Date(start.getTime() + LESSON_DURATION_MIN * 60000);
      slots.push({ start, end });
    }
  }
  return slots;
}

// ── Blockier-Prüfungen ─────────────────────────────────────

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

/** Kollision mit bestehendem Termin inkl. Puffer (Max. beider Puffer). */
export function collidesWithAppointment(
  slot: Slot,
  appt: ExistingAppointment,
  slotBufferMin: number
): boolean {
  const apptStart = new Date(appt.start_at).getTime();
  const apptEnd = new Date(appt.end_at).getTime();
  const gap =
    Math.max(slotBufferMin, appt.bufferMinutes ?? slotBufferMin) * 60000;
  // Genügend Abstand, wenn Slot ganz vor oder ganz nach dem Termin (+Puffer) liegt.
  const free =
    slot.end.getTime() + gap <= apptStart ||
    apptEnd + gap <= slot.start.getTime();
  return !free;
}

/** Greift eine Abwesenheit für diesen Schüler an diesem Datum? */
export function absenceBlocks(
  slot: Slot,
  absences: Absence[],
  studentId: string
): boolean {
  const date = utcToZonedDate(slot.start);
  const dnum = Date.UTC(date.y, date.m - 1, date.d);
  return absences.some((a) => {
    if (a.scope === "student" && a.student_id !== studentId) return false;
    const s = parseDateStr(a.start_date);
    const e = parseDateStr(a.end_date);
    const start = Date.UTC(s.y, s.m - 1, s.d);
    const end = Date.UTC(e.y, e.m - 1, e.d);
    return dnum >= start && dnum <= end; // inklusive
  });
}

/** Überlappt der Slot einen einmaligen Zeitblock? */
export function timeBlockBlocks(slot: Slot, blocks: TimeBlock[]): boolean {
  return blocks.some((b) => {
    const { y, m, d } = parseDateStr(b.date);
    const bs = parseHHMM(b.start_time);
    const be = parseHHMM(b.end_time);
    const start = zonedToUtc(y, m, d, bs.h, bs.m);
    const end = zonedToUtc(y, m, d, be.h, be.m);
    return overlaps(slot.start, slot.end, start, end);
  });
}

/** Überlappt der Slot eine aktive Wiederholungsregel (alle interval_days)? */
export function timeBlockRuleBlocks(slot: Slot, rules: TimeBlockRule[]): boolean {
  const slotDate = utcToZonedDate(slot.start);
  return rules.some((r) => {
    const ruleStart = parseDateStr(r.start_date);
    const diff = daysBetween(ruleStart, slotDate);
    if (diff < 0) return false;
    if (r.interval_days <= 0) return false;
    if (diff % r.interval_days !== 0) return false;
    const bs = parseHHMM(r.start_time);
    const be = parseHHMM(r.end_time);
    const start = zonedToUtc(slotDate.y, slotDate.m, slotDate.d, bs.h, bs.m);
    const end = zonedToUtc(slotDate.y, slotDate.m, slotDate.d, be.h, be.m);
    return overlaps(slot.start, slot.end, start, end);
  });
}

export type AvailabilityContext = {
  studentId: string;
  bufferMin: number;
  now: Date;
  appointments: ExistingAppointment[];
  absences: Absence[];
  timeBlocks: TimeBlock[];
  timeBlockRules: TimeBlockRule[];
};

/** Ist ein einzelner Slot buchbar? (alle Regeln) */
export function isSlotBookable(slot: Slot, ctx: AvailabilityContext): boolean {
  // 24-Stunden-Regel
  if (slot.start.getTime() < ctx.now.getTime() + BOOKING_LEAD_HOURS * 3600000) {
    return false;
  }
  if (ctx.absences.length && absenceBlocks(slot, ctx.absences, ctx.studentId)) {
    return false;
  }
  if (ctx.timeBlocks.length && timeBlockBlocks(slot, ctx.timeBlocks)) {
    return false;
  }
  if (ctx.timeBlockRules.length && timeBlockRuleBlocks(slot, ctx.timeBlockRules)) {
    return false;
  }
  for (const appt of ctx.appointments) {
    if (collidesWithAppointment(slot, appt, ctx.bufferMin)) return false;
  }
  return true;
}

/**
 * Alle buchbaren Slots über einen Datumsbereich (Zürcher Kalendertage).
 * `fromDate` = erster Tag (Zürich), `days` = Anzahl Tage.
 */
export function computeAvailableSlots(
  fromDate: CalDate,
  days: number,
  ctx: AvailabilityContext
): Slot[] {
  const result: Slot[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysCal(fromDate, i);
    for (const slot of generateDaySlots(date)) {
      if (isSlotBookable(slot, ctx)) result.push(slot);
    }
  }
  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// ── 24-Stunden-Regel (einzeln nutzbar) ─────────────────────

export function isAtLeast24hAway(start: Date | string, now: Date): boolean {
  return (
    new Date(start).getTime() - now.getTime() >= BOOKING_LEAD_HOURS * 3600000
  );
}

// ── Serien ─────────────────────────────────────────────────

/** Startzeitpunkte einer Serie ab `firstStart`. */
export function generateSeriesStarts(
  firstStart: Date,
  lessonsCount: number,
  intervalDays: number
): Date[] {
  const starts: Date[] = [];
  for (let i = 0; i < lessonsCount; i++) {
    starts.push(new Date(firstStart.getTime() + i * intervalDays * 86400000));
  }
  return starts;
}

/** Slots aus Startzeitpunkten (jeweils 45 Min). */
export function slotsFromStarts(starts: Date[]): Slot[] {
  return starts.map((start) => ({
    start,
    end: new Date(start.getTime() + LESSON_DURATION_MIN * 60000),
  }));
}

export type SeriesValidation = {
  ok: boolean;
  conflicts: Slot[]; // nicht buchbare Slots der Serie
};

/**
 * Prüft eine komplette Serie. Eine Serie ist nur buchbar, wenn JEDER Slot
 * buchbar ist (transaktional – alle oder keiner, Spec §4).
 */
export function validateSeries(
  firstStart: Date,
  lessonsCount: number,
  intervalDays: number,
  ctx: AvailabilityContext
): SeriesValidation {
  const slots = slotsFromStarts(
    generateSeriesStarts(firstStart, lessonsCount, intervalDays)
  );
  const conflicts = slots.filter((s) => !isSlotBookable(s, ctx));
  return { ok: conflicts.length === 0, conflicts };
}

export { calToString };
