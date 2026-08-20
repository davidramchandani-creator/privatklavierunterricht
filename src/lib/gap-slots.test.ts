import { describe, expect, it } from "vitest";
import {
  travelToBuffer,
  hhmmToMinutes as t,
  minutesToHhmm,
  validStartTimes,
  isValidStart,
  remainingCapacity,
  type BlockConfig,
} from "./gap-slots";

/** Standardszenario: 16:30–20:00, 45-Min-Lektionen, 15 Min Puffer. */
const cfg: BlockConfig = {
  block: { start: t("16:30"), end: t("20:00") },
  lessonMinutes: 45,
  bufferMinutes: 15,
};

const hhmm = (mins: number[]) => mins.map(minutesToHhmm);
const frei = (c: BlockConfig, occ: { start: number; end: number }[] = []) =>
  hhmm(validStartTimes(c, occ));

describe("Modus lueckenlos, leerer Block 16:30–20:00", () => {
  it("bietet nur bündig anschliessende Startzeiten", () => {
    // 210 Min Block, Einheit 60 Min (45 + 15 Puffer) → 3 Lektionen,
    // die letzten 45 Minuten bleiben zwangsläufig ungenutzt.
    expect(frei(cfg)).toEqual(["16:30", "17:30", "18:30"]);
  });

  it("lehnt 16:45 ab, es bliebe ein 15-Minuten-Loch am Blockanfang", () => {
    expect(isValidStart(t("16:45"), cfg)).toBe(false);
  });

  it("lehnt 17:15 ab, davor bliebe eine unbrauchbare 45-Minuten-Lücke", () => {
    expect(isValidStart(t("17:15"), cfg)).toBe(false);
  });

  it("lehnt 19:30 ab, die Lektion ragt über das Blockende hinaus", () => {
    expect(isValidStart(t("19:30"), cfg)).toBe(false);
  });
});

describe("Modus lueckenlos, Live-Neuberechnung", () => {
  const eine = [{ start: t("16:30"), end: t("17:15") }];
  const zwei = [...eine, { start: t("17:30"), end: t("18:15") }];

  it("nach der ersten Buchung bleiben die bündigen Anschlüsse", () => {
    // 18:30 bleibt gültig: dazwischen passt 17:30–18:15 exakt hinein.
    expect(frei(cfg, eine)).toEqual(["17:30", "18:30"]);
  });

  it("17:15 war vorher schon ungültig und bleibt es", () => {
    expect(isValidStart(t("17:15"), cfg, eine)).toBe(false);
  });

  it("nach zwei Buchungen bleibt der letzte Platz übrig", () => {
    expect(frei(cfg, zwei)).toEqual(["18:30"]);
  });

  it("der Block ist nach drei Buchungen voll", () => {
    const drei = [...zwei, { start: t("18:30"), end: t("19:15") }];
    expect(frei(cfg, drei)).toEqual([]);
  });

  it("füllt eine exakt passende Lücke zwischen zwei Terminen", () => {
    const rand = [
      { start: t("16:30"), end: t("17:15") },
      { start: t("18:30"), end: t("19:15") },
    ];
    expect(frei(cfg, rand)).toEqual(["17:30"]);
  });
});

describe("Modus maximal", () => {
  const max: BlockConfig = { ...cfg, packing: "maximal" };

  it("erlaubt mehr Startzeiten, solange die Kapazität erhalten bleibt", () => {
    const zeiten = frei(max);
    expect(zeiten).toContain("16:45"); // im lueckenlos-Modus verboten
    expect(zeiten.length).toBeGreaterThan(frei(cfg).length);
  });

  it("verhindert trotzdem kapazitätsvernichtende Zeiten", () => {
    // Nach 16:30 und 17:30 passt noch genau eine Lektion, 19:15 wäre
    // zulässig, eine Zeit die zwei Plätze kostet dagegen nicht.
    const zwei = [
      { start: t("16:30"), end: t("17:15") },
      { start: t("17:30"), end: t("18:15") },
    ];
    expect(remainingCapacity(cfg, zwei)).toBe(1);
    for (const z of validStartTimes(max, zwei)) {
      expect(remainingCapacity(cfg, [...zwei, { start: z, end: z + 45 }])).toBe(0);
    }
  });
});

describe("Konfigurierbarkeit", () => {
  it("funktioniert mit 60-Minuten-Lektionen", () => {
    // 3 × 60 + 2 × 15 = 210 → der Block geht exakt auf, kein Rest.
    const c60: BlockConfig = { ...cfg, lessonMinutes: 60 };
    expect(frei(c60)).toEqual(["16:30", "17:45", "19:00"]);
    expect(remainingCapacity(c60)).toBe(3);
  });

  it("funktioniert ohne Puffer", () => {
    const c0: BlockConfig = { ...cfg, bufferMinutes: 0 };
    expect(frei(c0, [{ start: t("16:30"), end: t("17:15") }])).toEqual([
      "17:15",
      "18:00",
      "18:45",
    ]);
  });

  it("respektiert ein feineres Raster, ohne Löcher zuzulassen", () => {
    const c5: BlockConfig = { ...cfg, gridMinutes: 5 };
    expect(frei(c5)).toEqual(["16:30", "17:30", "18:30"]);
  });
});

describe("Kapazitätsberechnung", () => {
  it("nennt die Anzahl möglicher Lektionen im leeren Block", () => {
    expect(remainingCapacity(cfg)).toBe(3);
  });

  it("reduziert sich mit jeder Buchung um genau eins", () => {
    const eine = [{ start: t("16:30"), end: t("17:15") }];
    expect(remainingCapacity(cfg, eine)).toBe(2);
    expect(
      remainingCapacity(cfg, [...eine, { start: t("17:30"), end: t("18:15") }])
    ).toBe(1);
  });

  it("ist 0, wenn der Restplatz zu klein ist", () => {
    expect(remainingCapacity(cfg, [{ start: t("16:30"), end: t("19:15") }])).toBe(0);
  });
});

describe("Fahrzeit → Puffer", () => {
  it("rundet auf das 15-Minuten-Raster auf", () => {
    expect(travelToBuffer(0)).toBe(15); // direkt nebenan: Minimum
    expect(travelToBuffer(8)).toBe(15);
    expect(travelToBuffer(15)).toBe(15);
    expect(travelToBuffer(20)).toBe(30); // Davids Beispiel
    expect(travelToBuffer(31)).toBe(45);
    expect(travelToBuffer(45)).toBe(45);
  });

  it("liefert nie NaN, auch bei Raster oder Minimum 0", () => {
    // 15/0 → Infinity·0 → NaN, und NaN als Puffer hat einmal das ganze
    // Buchungssystem lahmgelegt (Mindestpuffer 0 wurde als Raster
    // durchgereicht). Raster 0 fällt aufs Standardraster zurück,
    // Minimum 0 ist erlaubt und bleibt 0.
    expect(travelToBuffer(15, 0, 0)).toBe(15);
    expect(travelToBuffer(0, 0, 0)).toBe(0);
    expect(travelToBuffer(20, 0, 0)).toBe(30);
    expect(Number.isNaN(travelToBuffer(15, NaN, NaN))).toBe(false);
  });
});

describe("Unterschiedliche Puffer pro Schüler", () => {
  /** Schüler mit 20 Min Fahrt → 30 Min Puffer. */
  const weit = travelToBuffer(20);
  /** Schüler gleich um die Ecke → 15 Min Puffer. */
  const nah = travelToBuffer(5);

  it("der weiter entfernte Schüler bestimmt den Übergang", () => {
    const gebucht = [{ start: t("16:30"), end: t("17:15"), bufferMinutes: weit }];
    // Nach einem 30-Min-Puffer-Schüler beginnt die nächste Lektion um 17:45,
    // auch wenn der neue Schüler selbst nur 15 Min bräuchte.
    expect(isValidStart(t("17:30"), cfg, gebucht, nah)).toBe(false);
    expect(isValidStart(t("17:45"), cfg, gebucht, nah)).toBe(true);
  });

  it("gilt auch umgekehrt: naher Vorgänger, weiter Nachfolger", () => {
    const gebucht = [{ start: t("16:30"), end: t("17:15"), bufferMinutes: nah }];
    expect(isValidStart(t("17:30"), cfg, gebucht, nah)).toBe(true);
    // Der weit entfernte Schüler braucht 30 Min Abstand, nicht 15.
    expect(isValidStart(t("17:30"), cfg, gebucht, weit)).toBe(false);
    expect(isValidStart(t("17:45"), cfg, gebucht, weit)).toBe(true);
  });

  it("zeigt dem weit entfernten Schüler weniger Zeiten als dem nahen", () => {
    const nahZeiten = validStartTimes(cfg, [], nah);
    const weitZeiten = validStartTimes(cfg, [], weit);
    expect(hhmm(nahZeiten)).toEqual(["16:30", "17:30", "18:30"]);
    // 45 + 30 = 75 Min pro Lektion → 3 × 45 + 2 × 30 = 195 ≤ 210,
    // es passen also weiterhin drei Lektionen, nur später gestaffelt.
    expect(hhmm(weitZeiten)).toEqual(["16:30", "17:45", "19:00"]);
  });

  it("belegt bei gemischten Puffern trotzdem lückenlos", () => {
    const gebucht = [
      { start: t("16:30"), end: t("17:15"), bufferMinutes: weit }, // bis 17:45
      { start: t("17:45"), end: t("18:30"), bufferMinutes: nah },  // bis 18:45
    ];
    expect(hhmm(validStartTimes(cfg, gebucht, nah))).toEqual(["18:45"]);
  });
});
