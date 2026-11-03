// ============================================================
// Von Hand eingetragen: keine Pause dazurechnen
//
// David, 3. November 2026: Hugo jeden zweiten Montag um 18:10. Davor
// Daniel bis 18:00, Hausbesuch im selben Dorf. Das System rechnete 15
// Minuten Pause, nannte 18:10 belegt und legte sieben Termine still auf
// 20:00. „Wenn ich selber eintrage, dann ist das egal."
// ============================================================

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isSlotBookable, zonedToUtc, type AvailabilityContext } from "./booking";

const ohne = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function ctx(puffer: number): AvailabilityContext {
  return {
    studentId: "hugo",
    bufferMin: puffer,
    now: new Date("2026-11-01T12:00:00Z"),
    appointments: [
      { start_at: zonedToUtc(2026, 11, 9, 17, 15), end_at: zonedToUtc(2026, 11, 9, 18, 0), bufferMinutes: puffer },
      { start_at: zonedToUtc(2026, 11, 9, 19, 5), end_at: zonedToUtc(2026, 11, 9, 19, 50), bufferMinutes: puffer },
    ],
    absences: [],
    timeBlocks: [],
    timeBlockRules: [],
    availabilityWindows: { 1: [{ start: "16:15", end: "21:00" }] },
  };
}
const hugo = { start: zonedToUtc(2026, 11, 9, 18, 10), end: zonedToUtc(2026, 11, 9, 18, 55) };

describe("Hugo um 18:10", () => {
  it("mit 15 Minuten Pause gilt 18:10 als belegt (so war es)", () => {
    expect(isSlotBookable(hugo, ctx(15))).toBe(false);
  });
  it("ohne Pause, nur echte Überschneidung: 18:10 ist frei", () => {
    expect(isSlotBookable(hugo, ctx(0))).toBe(true);
  });
  it("eine echte Überschneidung bleibt belegt", () => {
    const quer = { start: zonedToUtc(2026, 11, 9, 17, 45), end: zonedToUtc(2026, 11, 9, 18, 30) };
    expect(isSlotBookable(quer, ctx(0))).toBe(false);
  });
});

describe("Wo David selbst entscheidet, gilt ohnePuffer", () => {
  const fx = ohne(readFileSync(join(process.cwd(), "src", "lib", "fixplatz-server.ts"), "utf8"));
  const fg = ohne(readFileSync(join(process.cwd(), "src", "lib", "freigabe-server.ts"), "utf8"));
  const ac = ohne(readFileSync(join(process.cwd(), "src", "app", "admin", "actions.ts"), "utf8"));
  it("die Serienplanung kennt den Schalter", () => {
    expect(fx).toMatch(/if \(params\.ohnePuffer\) \{\s*ctx\.bufferMin = 0;/);
  });
  it("Abo von Hand, Freigabe, Serie angleichen und fester Platz nutzen ihn", () => {
    expect(ac.match(/ohnePuffer: true/g)?.length).toBe(2);
    expect(fg.match(/ohnePuffer: true/g)?.length).toBeGreaterThanOrEqual(5);
  });
  it("Handänderungen in der Zuteilung prüfen nur echte Überschneidung", () => {
    expect(fg.match(/pufferMinuten = 0\n/g)?.length).toBe(2);
  });
  it("Ausweichtermine werden nicht mehr still gebucht", () => {
    expect(ac).toContain('formData.get("ausweich_ok") !== "1"');
    expect(ac).toContain("ausweichFrage: true as const");
  });
});
