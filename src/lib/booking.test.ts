import { describe, it, expect } from "vitest";
import {
  AVAILABILITY,
  LESSON_DURATION_MIN,
  generateDaySlots,
  computeAvailableSlots,
  isSlotBookable,
  collidesWithAppointment,
  absenceBlocks,
  timeBlockBlocks,
  timeBlockRuleBlocks,
  isAtLeast24hAway,
  generateSeriesStarts,
  validateSeries,
  zonedToUtc,
  utcToZonedDate,
  weekdayOf,
  addDaysCal,
  type AvailabilityContext,
  type CalDate,
} from "./booking";

// Hilfs-Kontext ohne Einschränkungen
function emptyCtx(overrides: Partial<AvailabilityContext> = {}): AvailabilityContext {
  return {
    studentId: "stud-1",
    bufferMin: 15,
    now: new Date("2026-01-01T00:00:00.000Z"), // weit in der Vergangenheit
    appointments: [],
    absences: [],
    timeBlocks: [],
    timeBlockRules: [],
    ...overrides,
  };
}

describe("Zeitzonen-Konvertierung (Europe/Zurich)", () => {
  it("Winterzeit: Zürich = UTC+1", () => {
    // 1. Feb 2026, 17:00 Zürich → 16:00 UTC
    const utc = zonedToUtc(2026, 2, 1, 17, 0);
    expect(utc.toISOString()).toBe("2026-02-01T16:00:00.000Z");
  });

  it("Sommerzeit: Zürich = UTC+2", () => {
    // 1. Juli 2026, 17:00 Zürich → 15:00 UTC
    const utc = zonedToUtc(2026, 7, 1, 17, 0);
    expect(utc.toISOString()).toBe("2026-07-01T15:00:00.000Z");
  });

  it("utcToZonedDate liefert Zürcher Kalenderdatum", () => {
    // 31. Jan 2026 23:30 UTC = 1. Feb 00:30 Zürich
    const d = utcToZonedDate(new Date("2026-01-31T23:30:00.000Z"));
    expect(d).toEqual({ y: 2026, m: 2, d: 1 });
  });
});

describe("Kalender-Helfer", () => {
  it("weekdayOf: 1. Feb 2026 ist ein Sonntag (0)", () => {
    expect(weekdayOf({ y: 2026, m: 2, d: 1 })).toBe(0);
  });
  it("weekdayOf: 2. Feb 2026 ist ein Montag (1)", () => {
    expect(weekdayOf({ y: 2026, m: 2, d: 2 })).toBe(1);
  });
  it("addDaysCal über Monatsgrenze", () => {
    expect(addDaysCal({ y: 2026, m: 1, d: 30 }, 3)).toEqual({ y: 2026, m: 2, d: 2 });
  });
});

describe("Slot-Erzeugung", () => {
  const montag: CalDate = { y: 2026, m: 2, d: 2 }; // Montag
  const freitag: CalDate = { y: 2026, m: 2, d: 6 }; // Freitag
  const samstag: CalDate = { y: 2026, m: 2, d: 7 }; // Samstag
  const sonntag: CalDate = { y: 2026, m: 2, d: 1 }; // Sonntag

  it("Montag 16:30–20:30 ergibt 14 Slots (45 Min, 15-Min-Raster)", () => {
    const slots = generateDaySlots(montag);
    // letzter Start 19:45, erster 16:30 → (195/15)+1 = 14
    expect(slots.length).toBe(14);
  });

  it("Erster Slot Montag startet 16:30 Zürich und dauert 45 Min", () => {
    const slots = generateDaySlots(montag);
    expect(slots[0].start.toISOString()).toBe("2026-02-02T15:30:00.000Z"); // 16:30 CET
    const dauer = (slots[0].end.getTime() - slots[0].start.getTime()) / 60000;
    expect(dauer).toBe(LESSON_DURATION_MIN);
  });

  it("Letzter Slot Montag startet 19:45 Zürich", () => {
    const slots = generateDaySlots(montag);
    expect(slots[slots.length - 1].start.toISOString()).toBe(
      "2026-02-02T18:45:00.000Z"
    ); // 19:45 CET
  });

  it("Freitag 16:30–18:00 ergibt 4 Slots", () => {
    const slots = generateDaySlots(freitag);
    expect(slots.length).toBe(4); // 16:30,16:45,17:00,17:15
  });

  it("Samstag und Sonntag haben keine Slots", () => {
    expect(generateDaySlots(samstag)).toHaveLength(0);
    expect(generateDaySlots(sonntag)).toHaveLength(0);
    expect(AVAILABILITY[6]).toBeUndefined();
    expect(AVAILABILITY[0]).toBeUndefined();
  });
});

describe("24-Stunden-Regel", () => {
  it("Termin in 25h ist erlaubt", () => {
    const now = new Date("2026-02-02T10:00:00.000Z");
    expect(isAtLeast24hAway(new Date("2026-02-03T11:00:00.000Z"), now)).toBe(true);
  });
  it("Termin in 23h ist nicht erlaubt", () => {
    const now = new Date("2026-02-02T10:00:00.000Z");
    expect(isAtLeast24hAway(new Date("2026-02-03T09:00:00.000Z"), now)).toBe(false);
  });

  it("computeAvailableSlots filtert Slots innerhalb von 24h heraus", () => {
    // now = Montag 16:00 Zürich (15:00 UTC). Slots am selben Montag sind <24h.
    const now = new Date("2026-02-02T15:00:00.000Z");
    const slots = computeAvailableSlots({ y: 2026, m: 2, d: 2 }, 1, emptyCtx({ now }));
    expect(slots).toHaveLength(0);
  });
});

describe("Puffer-Kollision", () => {
  const slot = {
    start: new Date("2026-02-02T16:00:00.000Z"), // 17:00 Zürich
    end: new Date("2026-02-02T16:45:00.000Z"),
  };

  it("Termin direkt danach ohne Puffer-Abstand kollidiert (15 Min)", () => {
    const appt = {
      start_at: "2026-02-02T16:45:00.000Z", // direkt im Anschluss → 0 Min Abstand
      end_at: "2026-02-02T17:30:00.000Z",
    };
    expect(collidesWithAppointment(slot, appt, 15)).toBe(true);
  });

  it("Termin mit genau 15 Min Abstand danach kollidiert NICHT", () => {
    const appt = {
      start_at: "2026-02-02T17:00:00.000Z", // 15 Min nach Slot-Ende
      end_at: "2026-02-02T17:45:00.000Z",
    };
    expect(collidesWithAppointment(slot, appt, 15)).toBe(false);
  });

  it("Bei 30-Min-Puffer kollidiert ein Termin 15 Min danach", () => {
    const appt = {
      start_at: "2026-02-02T17:00:00.000Z",
      end_at: "2026-02-02T17:45:00.000Z",
    };
    expect(collidesWithAppointment(slot, appt, 30)).toBe(true);
  });

  it("Puffer des bestehenden Termins (Max.) wird berücksichtigt", () => {
    const appt = {
      start_at: "2026-02-02T17:00:00.000Z",
      end_at: "2026-02-02T17:45:00.000Z",
      bufferMinutes: 30,
    };
    // Slot-Puffer 15, Termin-Puffer 30 → Max 30 → kollidiert
    expect(collidesWithAppointment(slot, appt, 15)).toBe(true);
  });
});

describe("Abwesenheiten", () => {
  const slot = {
    start: new Date("2026-02-02T16:00:00.000Z"), // Montag 17:00 Zürich
    end: new Date("2026-02-02T16:45:00.000Z"),
  };

  it("Admin-Abwesenheit blockiert für alle Schüler", () => {
    const absences = [
      { scope: "admin" as const, student_id: null, start_date: "2026-02-01", end_date: "2026-02-05" },
    ];
    expect(absenceBlocks(slot, absences, "stud-1")).toBe(true);
    expect(absenceBlocks(slot, absences, "stud-2")).toBe(true);
  });

  it("Schüler-Abwesenheit blockiert nur den betroffenen Schüler", () => {
    const absences = [
      { scope: "student" as const, student_id: "stud-1", start_date: "2026-02-02", end_date: "2026-02-02" },
    ];
    expect(absenceBlocks(slot, absences, "stud-1")).toBe(true);
    expect(absenceBlocks(slot, absences, "stud-2")).toBe(false);
  });

  it("Abwesenheit ausserhalb des Datums blockiert nicht", () => {
    const absences = [
      { scope: "admin" as const, student_id: null, start_date: "2026-02-03", end_date: "2026-02-05" },
    ];
    expect(absenceBlocks(slot, absences, "stud-1")).toBe(false);
  });
});

describe("Zeitblöcke", () => {
  const slot = {
    start: new Date("2026-02-02T16:00:00.000Z"), // 17:00 Zürich
    end: new Date("2026-02-02T16:45:00.000Z"), // 17:45 Zürich
  };

  it("Einmaliger Zeitblock überlappt → blockiert", () => {
    const blocks = [{ date: "2026-02-02", start_time: "17:00", end_time: "18:00" }];
    expect(timeBlockBlocks(slot, blocks)).toBe(true);
  });

  it("Zeitblock daneben blockiert nicht", () => {
    const blocks = [{ date: "2026-02-02", start_time: "18:00", end_time: "19:00" }];
    expect(timeBlockBlocks(slot, blocks)).toBe(false);
  });

  it("Wiederholungsregel alle 7 Tage greift am passenden Tag", () => {
    const rules = [
      { start_date: "2026-01-26", start_time: "17:00", end_time: "18:00", interval_days: 7 },
    ];
    // 2026-01-26 ist Montag; +7 = 2026-02-02 (passt)
    expect(timeBlockRuleBlocks(slot, rules)).toBe(true);
  });

  it("Wiederholungsregel alle 14 Tage greift NICHT in der Zwischenwoche", () => {
    const rules = [
      { start_date: "2026-01-26", start_time: "17:00", end_time: "18:00", interval_days: 14 },
    ];
    // +7 Tage (2026-02-02) ist kein Vielfaches von 14
    expect(timeBlockRuleBlocks(slot, rules)).toBe(false);
  });
});

describe("computeAvailableSlots (Gesamtintegration)", () => {
  const now = new Date("2026-01-01T00:00:00.000Z"); // alles >24h entfernt
  const montag: CalDate = { y: 2026, m: 2, d: 2 };

  it("Ohne Einschränkungen alle 14 Montags-Slots", () => {
    const slots = computeAvailableSlots(montag, 1, emptyCtx({ now }));
    expect(slots).toHaveLength(14);
  });

  it("Eine Woche (Mo–So) = 14+14+14+14+4 = 60 Slots", () => {
    const slots = computeAvailableSlots(montag, 7, emptyCtx({ now }));
    expect(slots).toHaveLength(60);
  });

  it("Bestehender Termin blockiert sich selbst + Puffer-Nachbarslots", () => {
    const appointments = [
      { start_at: "2026-02-02T16:00:00.000Z", end_at: "2026-02-02T16:45:00.000Z" }, // 17:00–17:45
    ];
    const slots = computeAvailableSlots(montag, 1, emptyCtx({ now, appointments }));
    // Es darf kein Slot übrig sein, der den Termin (inkl. 15-Min-Puffer) berührt.
    for (const s of slots) {
      const free =
        s.end.getTime() + 15 * 60000 <= new Date(appointments[0].start_at).getTime() ||
        new Date(appointments[0].end_at).getTime() + 15 * 60000 <= s.start.getTime();
      expect(free).toBe(true);
    }
    expect(slots.length).toBeLessThan(14);
  });

  it("Admin-Abwesenheit blockiert den ganzen Tag", () => {
    const absences = [
      { scope: "admin" as const, student_id: null, start_date: "2026-02-02", end_date: "2026-02-02" },
    ];
    const slots = computeAvailableSlots(montag, 1, emptyCtx({ now, absences }));
    expect(slots).toHaveLength(0);
  });
});

describe("Serien", () => {
  it("generateSeriesStarts: 5 Lektionen alle 7 Tage", () => {
    const start = new Date("2026-02-02T16:00:00.000Z");
    const starts = generateSeriesStarts(start, 5, 7);
    expect(starts).toHaveLength(5);
    expect(starts[1].toISOString()).toBe("2026-02-09T16:00:00.000Z");
    expect(starts[4].toISOString()).toBe("2026-03-02T16:00:00.000Z");
  });

  it("validateSeries ist ok, wenn alle Slots frei sind", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const start = new Date("2026-02-02T16:00:00.000Z"); // Montag 17:00 Zürich
    const result = validateSeries(start, 3, 7, emptyCtx({ now }));
    expect(result.ok).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it("validateSeries schlägt fehl, wenn ein Serientermin kollidiert", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const start = new Date("2026-02-02T16:00:00.000Z");
    // Zweiter Serientermin (2026-02-09 17:00) ist durch Admin-Abwesenheit blockiert
    const absences = [
      { scope: "admin" as const, student_id: null, start_date: "2026-02-09", end_date: "2026-02-09" },
    ];
    const result = validateSeries(start, 3, 7, emptyCtx({ now, absences }));
    expect(result.ok).toBe(false);
    expect(result.conflicts).toHaveLength(1);
  });
});

describe("isSlotBookable (Kombination)", () => {
  it("Slot in der Vergangenheit (24h-Regel) nicht buchbar", () => {
    const slot = {
      start: new Date("2026-02-02T16:00:00.000Z"),
      end: new Date("2026-02-02T16:45:00.000Z"),
    };
    const ctx = emptyCtx({ now: new Date("2026-02-02T10:00:00.000Z") });
    expect(isSlotBookable(slot, ctx)).toBe(false);
  });
});
