// ============================================================
// 10 Minuten Pause zwischen zwei Studio-Lektionen
//
// David, 3. November 2026: Kommen die Schüler zu ihm, reichen 10 Minuten
// zwischen zwei Lektionen. Startzeiten dürfen dafür auch 17:25 sein.
// Grenzt eine Studio-Lektion an einen Hausbesuch, bleibt es bei 15.
// ============================================================

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeAvailableSlots,
  wirksamerPuffer,
  zonedToUtc,
  STUDIO_PAUSE_MIN,
  type AvailabilityContext,
  type ExistingAppointment,
} from "./booking";
import { gapAwareDaySlots, DEFAULT_BLOCK_SETTINGS } from "./booking-gap";
import { planeRouten, type PlanSchueler } from "./routing";
import { findeKonflikt } from "./zuteilung-uebernahme";
import { fahrzeitMitCache } from "./geo";

const MONTAG = { y: 2026, m: 11, d: 16 };
const FENSTER = { 1: [{ start: "16:30", end: "20:30" }] };

function zeit(slot: { start: Date }): string {
  return slot.start.toLocaleTimeString("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function termin(von: string, bis: string, buffer: number): ExistingAppointment {
  const [vh, vm] = von.split(":").map(Number);
  const [bh, bm] = bis.split(":").map(Number);
  return {
    start_at: zonedToUtc(MONTAG.y, MONTAG.m, MONTAG.d, vh, vm),
    end_at: zonedToUtc(MONTAG.y, MONTAG.m, MONTAG.d, bh, bm),
    bufferMinutes: buffer,
  };
}

function ctx(bufferMin: number, appointments: ExistingAppointment[]): AvailabilityContext {
  return {
    studentId: "neu",
    bufferMin,
    now: new Date("2026-11-01T12:00:00Z"),
    appointments,
    absences: [],
    timeBlocks: [],
    timeBlockRules: [],
    availabilityWindows: FENSTER,
  };
}

describe("Wirksamer Puffer", () => {
  it("im Studio 10 Minuten, beim Hausbesuch der eigene Puffer", () => {
    expect(wirksamerPuffer(false, 15)).toBe(STUDIO_PAUSE_MIN);
    expect(STUDIO_PAUSE_MIN).toBe(10);
    expect(wirksamerPuffer(true, 15)).toBe(15);
    expect(wirksamerPuffer(true, null)).toBe(15);
  });
});

describe("Buchungs-Engine", () => {
  it("nach einer Studio-Lektion bis 17:15 ist 17:25 frei, für Studio-Schüler", () => {
    const slots = computeAvailableSlots(MONTAG, 1, ctx(10, [termin("16:30", "17:15", 10)]));
    const zeiten = slots.map(zeit);
    expect(zeiten).toContain("17:25");
    expect(zeiten).not.toContain("17:20");
  });

  it("grenzt ein Hausbesuch an, bleiben es 15 Minuten", () => {
    const slots = computeAvailableSlots(MONTAG, 1, ctx(10, [termin("16:30", "17:15", 15)]));
    const zeiten = slots.map(zeit);
    expect(zeiten).not.toContain("17:25");
    expect(zeiten).toContain("17:30");
  });

  it("ein Hausbesuch-Schüler nach einer Studio-Lektion braucht ebenfalls 15", () => {
    const slots = computeAvailableSlots(MONTAG, 1, ctx(15, [termin("16:30", "17:15", 10)]));
    expect(slots.map(zeit)).not.toContain("17:25");
  });

  it("Slot-Liste der Webseite bietet 17:25 an", () => {
    const slots = gapAwareDaySlots(
      MONTAG,
      ctx(10, [termin("16:30", "17:15", 10)]),
      { ...DEFAULT_BLOCK_SETTINGS, minBufferMinutes: 0, packing: "maximal" },
      FENSTER
    );
    const zeiten = slots.map(zeit);
    expect(zeiten).toContain("17:25");
    expect(zeiten).not.toContain("17:20");
    // Kein 5-Minuten-Gewimmel: nur die Anschlusszeit kommt dazu.
    expect(zeiten).not.toContain("18:35");
  });
});

describe("Routenplaner", () => {
  const Z = { lat: 47.52879, lng: 8.67157 };
  const studio = (id: string): PlanSchueler => ({
    id,
    name: id,
    ...Z,
    rhythmus: "woechentlich",
    lektionMinuten: 45,
    moeglicheTage: [1],
    fenster: [{ wochentag: 1, fruehestens: "16:30", spaetestens: "20:30" }],
    kwPraeferenz: null,
  });

  it("drei Studio-Lektionen: 16:30, 17:25, 18:20", () => {
    const plan = planeRouten({
      zuhause: Z,
      schueler: [studio("A"), studio("B"), studio("C")],
      fenster: [{ wochentag: 1, beginn: "16:30", ende: "20:30" }],
      pufferMinuten: 15,
      fahrzeit: fahrzeitMitCache(new Map()),
      maxPaarDistanzM: 5000,
    });
    const beginn = plan.tage.flatMap((t) => t.positionen.map((p) => p.beginn)).sort();
    expect(beginn[0]).toBe("16:30");
    expect(beginn).toEqual(["16:30", "17:25", "18:20"]);
  });
});

describe("Zuteilung von Hand", () => {
  const eintrag = (schuelerId: string, beginn: string) => ({
    schuelerId,
    name: schuelerId,
    wochentag: 1,
    beginn,
    paritaet: null,
    beginnUngerade: null,
  });
  it("zwei Studio-Schüler: 17:25 nach 16:30 passt", () => {
    const uebrige = [eintrag("A", "16:30")] as never;
    expect(findeKonflikt(eintrag("B", "17:25"), uebrige, 15, new Set(["A", "B"]))).toBeNull();
  });
  it("sonst kollidiert 17:25 mit 16:30", () => {
    const uebrige = [eintrag("A", "16:30")] as never;
    expect(findeKonflikt(eintrag("B", "17:25"), uebrige, 15, new Set(["B"]))).toBe("A");
  });
});

describe("Server lädt, wer ins Studio kommt", () => {
  it("Termine und Kontext tragen den Studio-Puffer", () => {
    const quelle = readFileSync(join(process.cwd(), "src", "lib", "booking-server.ts"), "utf8");
    expect(quelle).toContain("profiles(buffer_time_minutes, hausbesuch)");
    expect(quelle).toContain("wirksamerPuffer(prof?.hausbesuch, prof?.buffer_time_minutes)");
    expect(quelle).toMatch(/bufferMin: imStudio \? STUDIO_PAUSE_MIN : studentBufferMin/);
  });
});
