import { describe, expect, it } from "vitest";
import { gapAwareDaySlots, type BlockSettings } from "./booking-gap";
import { type AvailabilityContext, zonedToUtc } from "./booking";

/** Montag, 10. August 2026 (weekday 1). */
const DAY = { y: 2026, m: 8, d: 10 };
const at = (h: number, min: number) => zonedToUtc(DAY.y, DAY.m, DAY.d, h, min);

const settings: BlockSettings = {
  lessonMinutes: 45,
  minBufferMinutes: 15,
  packing: "lueckenlos",
};

/** Wie im Betrieb: Montag 16:30–20:00. */
const windows = { 1: [{ start: "16:30", end: "20:00" }] };

function ctx(over: Partial<AvailabilityContext> = {}): AvailabilityContext {
  return {
    studentId: "s1",
    bufferMin: 15,
    // Weit vor dem Termin, damit die 24h-Regel nie stört.
    now: zonedToUtc(2026, 8, 1, 8, 0),
    appointments: [],
    absences: [],
    timeBlocks: [],
    timeBlockRules: [],
    availabilityWindows: windows,
    ...over,
  };
}

const times = (slots: { start: Date }[]) =>
  slots.map((s) =>
    new Intl.DateTimeFormat("de-CH", {
      timeZone: "Europe/Zurich",
      hour: "2-digit",
      minute: "2-digit",
    }).format(s.start)
  );

describe("Integration: gap-aware Slots am realen Tag", () => {
  it("liefert im leeren Block die bündigen Startzeiten", () => {
    expect(times(gapAwareDaySlots(DAY, ctx(), settings, windows))).toEqual([
      "16:30",
      "17:30",
      "18:30",
    ]);
  });

  it("berücksichtigt bestehende Termine samt Puffer", () => {
    const c = ctx({
      appointments: [
        { start_at: at(16, 30).toISOString(), end_at: at(17, 15).toISOString(), bufferMinutes: 15 },
      ],
    });
    expect(times(gapAwareDaySlots(DAY, c, settings, windows))).toEqual([
      "17:30",
      "18:30",
    ]);
  });

  it("respektiert den grösseren Puffer eines weit entfernten Schülers", () => {
    const c = ctx({
      appointments: [
        { start_at: at(16, 30).toISOString(), end_at: at(17, 15).toISOString(), bufferMinutes: 30 },
      ],
    });
    // Nach einem 30-Minuten-Puffer geht es erst um 17:45 weiter.
    expect(times(gapAwareDaySlots(DAY, c, settings, windows))).toContain("17:45");
    expect(times(gapAwareDaySlots(DAY, c, settings, windows))).not.toContain("17:30");
  });

  it("blendet Zeitblöcke aus", () => {
    const c = ctx({
      timeBlocks: [{ date: "2026-08-10", start_time: "16:30", end_time: "17:15" }],
    });
    expect(times(gapAwareDaySlots(DAY, c, settings, windows))).not.toContain("16:30");
  });

  it("liefert an einem Abwesenheitstag gar nichts", () => {
    const c = ctx({
      absences: [
        { scope: "admin", student_id: null, start_date: "2026-08-10", end_date: "2026-08-12" },
      ],
    });
    expect(gapAwareDaySlots(DAY, c, settings, windows)).toEqual([]);
  });

  it("blendet eine wiederkehrende Sperrregel aus, die auf den Tag fällt", () => {
    // 10.8.2026 ist 67 Tage nach dem 4.6.2026 – 67 % 7 !== 0, also greift
    // die Regel an diesem Montag NICHT.
    const montag = times(
      gapAwareDaySlots(
        DAY,
        ctx({
          timeBlockRules: [
            {
              start_date: "2026-06-04",
              start_time: "19:00",
              end_time: "20:00",
              interval_days: 7,
            },
          ],
        }),
        settings,
        windows
      )
    );
    expect(montag).toEqual(["16:30", "17:30", "18:30"]);

    // Der 3.8.2026 ist 60 Tage nach dem 4.6., ebenfalls kein Treffer.
    // Passend ist der 10.8. nur, wenn die Regel am 6.7.2026 startet
    // (35 Tage, 35 % 7 === 0).
    const gesperrt = times(
      gapAwareDaySlots(
        DAY,
        ctx({
          timeBlockRules: [
            {
              start_date: "2026-07-06",
              start_time: "19:00",
              end_time: "20:00",
              interval_days: 7,
            },
          ],
        }),
        settings,
        windows
      )
    );
    expect(gesperrt).toEqual(["16:30", "17:30"]);
  });

  it("ignoriert eine Sperrregel vor ihrem Startdatum", () => {
    const slots = times(
      gapAwareDaySlots(
        DAY,
        ctx({
          timeBlockRules: [
            {
              start_date: "2026-09-07",
              start_time: "19:00",
              end_time: "20:00",
              interval_days: 7,
            },
          ],
        }),
        settings,
        windows
      )
    );
    expect(slots).toEqual(["16:30", "17:30", "18:30"]);
  });

  it("wendet die 24-Stunden-Regel an", () => {
    const c = ctx({ now: zonedToUtc(2026, 8, 10, 12, 0) }); // nur 4h vorher
    expect(gapAwareDaySlots(DAY, c, settings, windows)).toEqual([]);
  });

  it("liefert an einem Tag ohne Fenster nichts", () => {
    const sonntag = { y: 2026, m: 8, d: 9 };
    expect(gapAwareDaySlots(sonntag, ctx(), settings, windows)).toEqual([]);
  });
});
