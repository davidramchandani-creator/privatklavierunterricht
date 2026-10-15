import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describeFixplatz, fixplatzSeriesStarts, firstSeriesStart, zeitFuerTag } from "./fixplatz";
import { weekParity } from "./rhythmus";
import { ueberschneidet } from "./zuteilung-uebernahme";
import { geteilteZeiten } from "./planung-server";

/**
 * Jede Woche am selben Tag, aber in ungeraden Wochen zu einer anderen Zeit.
 * Gerade Wochen: `time`, ungerade Wochen: `timeUngerade`.
 */

const lokal = (d: Date) =>
  d.toLocaleTimeString("de-CH", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit" });
const tagUtc = (d: Date) => {
  const s = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Zurich" });
  return new Date(`${s}T00:00:00Z`);
};

describe("Serie mit zweiter Uhrzeit", () => {
  const wunsch = {
    weekday: 1,
    time: "17:15",
    timeUngerade: "18:30",
    rhythmus: "woechentlich" as const,
    lessons: 30,
  };
  // Über Herbst-Zeitumstellung und Neujahr 2027 (53 Wochen) hinweg.
  const starts = fixplatzSeriesStarts(wunsch, new Date("2026-10-05T15:15:00Z"));

  it("jede Woche ein Termin, immer montags", () => {
    expect(starts).toHaveLength(30);
    for (let i = 1; i < starts.length; i++) {
      const tage = Math.round((tagUtc(starts[i]).getTime() - tagUtc(starts[i - 1]).getTime()) / 86400000);
      expect(tage).toBe(7);
    }
  });

  it("gerade Wochen zur ersten, ungerade zur zweiten Zeit, auch nach Zeitumstellung und Neujahr", () => {
    for (const s of starts) {
      const soll = weekParity(tagUtc(s)) === 1 ? "18:30" : "17:15";
      expect(lokal(s)).toBe(soll);
    }
    // Beide Zeiten kommen tatsächlich vor.
    expect(new Set(starts.map(lokal))).toEqual(new Set(["17:15", "18:30"]));
  });

  it("der erste Termin nimmt die Zeit seiner Woche", () => {
    const erster = firstSeriesStart(wunsch, new Date("2026-10-01T08:00:00Z"), null);
    expect(lokal(erster)).toBe(zeitFuerTag(wunsch, tagUtc(erster)));
  });

  it("ohne zweite Zeit bleibt alles wie bisher", () => {
    const ohne = fixplatzSeriesStarts({ ...wunsch, timeUngerade: null }, new Date("2026-10-05T15:15:00Z"));
    expect(new Set(ohne.map(lokal))).toEqual(new Set(["17:15"]));
  });

  it("bei alle zwei Wochen wird die zweite Zeit ignoriert", () => {
    const zw = fixplatzSeriesStarts(
      { ...wunsch, rhythmus: "zweiwoechentlich" },
      new Date("2026-10-05T15:15:00Z")
    );
    expect(new Set(zw.map(lokal))).toEqual(new Set(["17:15"]));
  });
});

describe("Beschreibung", () => {
  it("nennt beide Zeiten", () => {
    expect(describeFixplatz(1, "17:15", "woechentlich", null, "18:30")).toBe(
      "Jeden Montag, gerade Wochen um 17:15, ungerade Wochen um 18:30"
    );
  });
  it("gleiche Zeit zweimal ist eine Zeit", () => {
    expect(describeFixplatz(1, "17:15", "woechentlich", null, "17:15")).toBe("Jeden Montag um 17:15");
  });
});

describe("Überschneidung in der Zuteilung", () => {
  const geteilt = { wochentag: 1, beginn: "17:15", paritaet: null, beginnUngerade: "18:15" };

  it("passt neben jemanden, der nur in ungeraden Wochen um 17:15 kommt", () => {
    expect(ueberschneidet(geteilt, { wochentag: 1, beginn: "17:15", paritaet: 1 }, 45, 15)).toBe(false);
  });
  it("kollidiert mit gerade Wochen 17:15", () => {
    expect(ueberschneidet(geteilt, { wochentag: 1, beginn: "17:15", paritaet: 0 }, 45, 15)).toBe(true);
  });
  it("kollidiert mit ungerade Wochen 18:15", () => {
    expect(ueberschneidet(geteilt, { wochentag: 1, beginn: "18:15", paritaet: 1 }, 45, 15)).toBe(true);
  });
  it("ohne zweite Zeit belegt jede Woche dieselbe Zeit, wie bisher", () => {
    const einfach = { wochentag: 1, beginn: "17:15", paritaet: null };
    expect(ueberschneidet(einfach, { wochentag: 1, beginn: "17:15", paritaet: 1 }, 45, 15)).toBe(true);
  });
});

describe("Der Planer blockiert beide Zeiten", () => {
  it("wird zu zwei belegten Zeiten, je in ihrer Woche", () => {
    expect(geteilteZeiten({ x: 1 }, "17:15", null, "18:30")).toEqual([
      { x: 1, beginn: "17:15", paritaet: 0 },
      { x: 1, beginn: "18:30", paritaet: 1 },
    ]);
    expect(geteilteZeiten({ x: 1 }, "17:15", null, null)).toEqual([
      { x: 1, beginn: "17:15", paritaet: null },
    ]);
  });
});

describe("Verdrahtung", () => {
  const ohne = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const lies = (...p: string[]) => ohne(readFileSync(join(process.cwd(), ...p), "utf8"));
  const externe = lies("src", "lib", "externe-server.ts");
  const freigabe = lies("src", "lib", "freigabe-server.ts");
  const jobs = lies("src", "lib", "subscription-jobs.ts");
  const fixServer = lies("src", "lib", "fixplatz-server.ts");
  const umstellung = lies("src", "lib", "umstellung-server.ts");
  const planung = lies("src", "lib", "planung-server.ts");
  const actions = lies("src", "app", "admin", "actions.ts");

  it("Externe: Serie und Speichern kennen die zweite Zeit", () => {
    expect(externe).toContain("timeUngerade: v.zeit_ungerade");
    expect(externe).toMatch(/zeit_ungerade:\s*\n?\s*params\.paritaet === null && params\.beginnUngerade/);
    expect(actions).toContain('formData.get("zeit_ungerade")');
    expect((actions.match(/zeitUngeradeAus\(formData, rhythmus, zeit\)/g) ?? []).length).toBe(2);
  });

  it("Abo: Freigabe, direkte Änderung, Umstellung und Nachholstunde", () => {
    expect((freigabe.match(/fixplatz_time_ungerade: zweiteZeit/g) ?? []).length).toBe(2);
    expect(umstellung).toContain("fixplatz_time_ungerade: zweiteZeit");
    expect(fixServer).toContain("timeUngerade: pkg.fixplatz_time_ungerade");
  });

  it("die Verlängerung nimmt die zweite Zeit mit", () => {
    expect((jobs.match(/fixplatz_time_ungerade: pkg\.fixplatz_time_ungerade \?\? null/g) ?? []).length).toBe(2);
    expect(jobs).toContain("timeUngerade: pkg.fixplatz_time_ungerade");
    expect(jobs).toContain("timeUngerade: next.fixplatz_time_ungerade");
  });

  it("der Planer liest sie bei Abos und Externen", () => {
    expect((planung.match(/\.\.\.geteilteZeiten\(/g) ?? []).length).toBe(2);
    expect(planung).toContain("fixplatz_time_ungerade");
    expect(planung).toContain("zeit_ungerade");
  });
});
