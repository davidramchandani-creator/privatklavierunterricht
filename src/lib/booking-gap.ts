/**
 * Brücke zwischen der Buchungs-Engine (booking.ts) und dem lückenlosen
 * Slot-Generator (gap-slots.ts).
 *
 * booking.ts erzeugte bisher stur alle 15 Minuten einen Kandidaten und filterte
 * danach. Das führte zu Restlücken, in die keine Lektion mehr passt. Hier wird
 * stattdessen pro Tag und Block gerechnet:
 *
 *   1. Belegte Zeiten des Blocks sammeln (Termine + Zeitblöcke), jeweils mit
 *      dem Puffer des betroffenen Schülers.
 *   2. Über gap-slots die gültigen Startzeiten bestimmen.
 *   3. Nur noch 24-Stunden-Regel und Abwesenheiten anwenden.
 */

import {
  type AvailabilityContext,
  type AvailabilityWindows,
  type Slot,
  AVAILABILITY,
  BOOKING_LEAD_HOURS,
  DEFAULT_BUFFER_MIN,
  LESSON_DURATION_MIN,
  absenceBlocks,
  addDaysCal,
  type CalDate,
  utcToZonedDate,
  weekdayOf,
  zonedToUtc,
} from "@/lib/booking";
import {
  type BlockConfig,
  type Interval,
  DEFAULT_GRID_MINUTES,
  validStartTimes,
  isValidStart,
  travelToBuffer,
} from "@/lib/gap-slots";

/** Konfiguration eines Blocks, wie sie aus `admin_verfuegbarkeit` kommt. */
export type BlockSettings = {
  lessonMinutes: number;
  minBufferMinutes: number;
  packing: "lueckenlos" | "maximal";
};

export const DEFAULT_BLOCK_SETTINGS: BlockSettings = {
  lessonMinutes: LESSON_DURATION_MIN,
  minBufferMinutes: DEFAULT_BUFFER_MIN,
  packing: "lueckenlos",
};

/** Minuten seit Mitternacht (Zürcher Wandzeit) für einen UTC-Instant. */
function minutesOfDay(instant: Date, day: CalDate): number {
  const midnight = zonedToUtc(day.y, day.m, day.d, 0, 0).getTime();
  return Math.round((instant.getTime() - midnight) / 60000);
}

function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/**
 * Gültige Startzeiten für einen einzelnen Tag, über alle Blöcke dieses
 * Wochentags hinweg.
 */
export function gapAwareDaySlots(
  day: CalDate,
  ctx: AvailabilityContext,
  settings: BlockSettings = DEFAULT_BLOCK_SETTINGS,
  availability: AvailabilityWindows = AVAILABILITY
): Slot[] {
  const windows = availability[weekdayOf(day)] ?? [];
  if (windows.length === 0) return [];

  // Puffer des anfragenden Schülers: Fahrzeit, aufgerundet aufs
  // **Slot-Raster** (15 Min.), mindestens der konfigurierte Mindestpuffer.
  // Der Mindestpuffer ist NICHT das Raster — er darf 0 sein, ein Raster
  // von 0 wäre eine Division durch null (siehe travelToBuffer).
  const myBuffer = travelToBuffer(
    ctx.bufferMin ?? settings.minBufferMinutes,
    DEFAULT_GRID_MINUTES,
    settings.minBufferMinutes
  );

  const dayStart = zonedToUtc(day.y, day.m, day.d, 0, 0).getTime();
  const dayEnd = dayStart + 24 * 3600 * 1000;

  // Termine dieses Tages als Belegung, inklusive Puffer des jeweiligen Schülers.
  const busyAll: Interval[] = ctx.appointments
    .map((a) => {
      const s = new Date(a.start_at).getTime();
      const e = new Date(a.end_at).getTime();
      return { s, e, buf: a.bufferMinutes };
    })
    .filter((a) => a.e > dayStart && a.s < dayEnd)
    .map((a) => ({
      start: minutesOfDay(new Date(a.s), day),
      end: minutesOfDay(new Date(a.e), day),
      bufferMinutes: travelToBuffer(
        a.buf ?? settings.minBufferMinutes,
        DEFAULT_GRID_MINUTES,
        settings.minBufferMinutes
      ),
    }));

  // Zeitblöcke des Tages ebenfalls als Belegung (mit Mindestpuffer).
  const dayKey = `${day.y}-${String(day.m).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;
  for (const tb of ctx.timeBlocks) {
    if (tb.date !== dayKey) continue;
    busyAll.push({
      start: hhmmToMin(tb.start_time),
      end: hhmmToMin(tb.end_time),
      bufferMinutes: settings.minBufferMinutes,
    });
  }

  // Wiederkehrende Sperrregeln (alle 7 bzw. 14 Tage ab start_date).
  const dayNum = Date.UTC(day.y, day.m - 1, day.d);
  for (const rule of ctx.timeBlockRules) {
    if (!rule.interval_days || rule.interval_days <= 0) continue;
    const [ry, rm, rd] = rule.start_date.split("-").map(Number);
    const diffDays = Math.round((dayNum - Date.UTC(ry, rm - 1, rd)) / 86400000);
    if (diffDays < 0 || diffDays % rule.interval_days !== 0) continue;
    busyAll.push({
      start: hhmmToMin(rule.start_time),
      end: hhmmToMin(rule.end_time),
      bufferMinutes: settings.minBufferMinutes,
    });
  }

  const result: Slot[] = [];

  for (const w of windows) {
    const cfg: BlockConfig = {
      block: { start: hhmmToMin(w.start), end: hhmmToMin(w.end) },
      lessonMinutes: settings.lessonMinutes,
      bufferMinutes: settings.minBufferMinutes,
      packing: settings.packing,
    };

    // Nur Belegungen berücksichtigen, die diesen Block überhaupt berühren.
    const busy = busyAll.filter(
      (b) => b.end > cfg.block.start && b.start < cfg.block.end
    );

    for (const startMin of validStartTimes(cfg, busy, myBuffer)) {
      const start = new Date(dayStart + startMin * 60000);
      const end = new Date(start.getTime() + settings.lessonMinutes * 60000);
      const slot: Slot = { start, end };

      // 24-Stunden-Vorlauf (für Admin-Aktionen überspringbar).
      if (
        !ctx.skipLeadTime &&
        start.getTime() < ctx.now.getTime() + BOOKING_LEAD_HOURS * 3600000
      ) {
        continue;
      }
      // Abwesenheiten (Admin oder dieser Schüler).
      if (ctx.absences.length && absenceBlocks(slot, ctx.absences, ctx.studentId)) {
        continue;
      }
      result.push(slot);
    }
  }

  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Gültige Startzeiten über einen Datumsbereich. */
export function gapAwareSlots(
  fromDate: CalDate,
  days: number,
  ctx: AvailabilityContext,
  settings: BlockSettings = DEFAULT_BLOCK_SETTINGS
): Slot[] {
  const availability = ctx.availabilityWindows ?? AVAILABILITY;
  const out: Slot[] = [];
  for (let i = 0; i < days; i++) {
    out.push(
      ...gapAwareDaySlots(addDaysCal(fromDate, i), ctx, settings, availability)
    );
  }
  return out;
}

/**
 * Serverseitige Einzelprüfung: Ist genau dieser Startzeitpunkt buchbar?
 * Wird vor jeder Buchung aufgerufen, dem Client wird nie vertraut.
 */
export function isGapAwareStartBookable(
  start: Date,
  ctx: AvailabilityContext,
  settings: BlockSettings = DEFAULT_BLOCK_SETTINGS
): boolean {
  const day = utcToZonedDate(start);
  const slots = gapAwareDaySlots(
    day,
    ctx,
    settings,
    ctx.availabilityWindows ?? AVAILABILITY
  );
  return slots.some((s) => s.start.getTime() === start.getTime());
}

export { isValidStart, travelToBuffer };
