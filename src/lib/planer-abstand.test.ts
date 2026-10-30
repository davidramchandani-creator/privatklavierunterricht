// ============================================================
// Planer: Die Pause enthält die Fahrt
//
// 30. Oktober 2026: Der Planer warf Daniel, Marina und Flurina aus einem
// Plan, der seit September jede Woche aufgeht. Er addierte Fahrt und Pause
// (4 Min. + 15 Min.) und hob das aufs Viertelstunden-Raster: 30 Minuten
// Abstand statt 15. Die Daten hier sind der echte Donnerstag und Montag.
// ============================================================

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { abstandMin, planeRouten, type PlanSchueler, type Tagesfenster } from "./routing";
import { fahrzeitMitCache } from "./geo";

const ZUHAUSE = { lat: 47.52879, lng: 8.67157 };

function fest(
  id: string,
  ort: { lat: number; lng: number },
  tag: number,
  beginn: string,
  paritaet: "gerade" | "ungerade" | null
): PlanSchueler {
  const [h, m] = beginn.split(":").map(Number);
  const e = h * 60 + m + 45;
  const bis = `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
  return {
    id,
    name: id,
    ...ort,
    rhythmus: paritaet ? "zweiwoechentlich" : "woechentlich",
    lektionMinuten: 45,
    moeglicheTage: [tag],
    fenster: [{ wochentag: tag, fruehestens: beginn, spaetestens: bis }],
    kwPraeferenz: paritaet,
  };
}

const SCHUELER: PlanSchueler[] = [
  fest("Daniel", { lat: 47.52992, lng: 8.66332 }, 1, "17:15", "gerade"),
  fest("Marina", { lat: 47.52817, lng: 8.66959 }, 1, "17:15", "ungerade"),
  fest("Emilie", { lat: 47.52717, lng: 8.66279 }, 1, "18:15", "ungerade"),
  fest("Angela", { lat: 47.53108, lng: 8.66475 }, 4, "16:00", null),
  fest("Flurina", { lat: 47.54092, lng: 8.67972 }, 4, "17:00", null),
  fest("Maurice", { lat: 47.57636, lng: 8.66940 }, 4, "18:00", "gerade"),
  fest("Justine", { lat: 47.54399, lng: 8.70491 }, 4, "18:00", "ungerade"),
];

const FENSTER: Tagesfenster[] = [
  { wochentag: 1, beginn: "16:15", ende: "21:00", start: { lat: 47.37766, lng: 8.53468 } },
  { wochentag: 4, beginn: "13:30", ende: "21:00" },
];

describe("Abstand zwischen zwei Lektionen", () => {
  it("die Pause ist eine Untergrenze, die Fahrt steckt darin", () => {
    expect(abstandMin(4, 15)).toBe(15);
    expect(abstandMin(9.2, 15)).toBe(15);
    // Längere Fahrt: Dann zählt die Fahrt, nicht Fahrt plus Pause.
    expect(abstandMin(22, 15)).toBe(22);
  });

  it("der echte Plan vom Herbst 2026 geht auf, niemand fällt heraus", () => {
    const plan = planeRouten({
      zuhause: ZUHAUSE,
      schueler: SCHUELER,
      fenster: FENSTER,
      pufferMinuten: 15,
      fahrzeit: fahrzeitMitCache(new Map()),
      maxPaarDistanzM: 5000,
    });
    expect(plan.nichtEingeplant.map((n) => n.schueler.name)).toEqual([]);
    const zeiten = plan.tage.flatMap((t) =>
      t.positionen.map((p) => `${t.wochentag} ${p.beginn}`)
    );
    expect(zeiten).toEqual(["1 17:15", "1 18:15", "4 16:00", "4 17:00", "4 18:00"]);
  });

  it("Gegenprobe: Fahrt plus Pause addiert taucht im Planer nicht mehr auf", () => {
    const quelle = readFileSync(join(process.cwd(), "src", "lib", "routing.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(quelle).not.toMatch(/anfahrtMin\)?\s*\+\s*(eingabe\.)?pufferMinuten/);
    expect(quelle).not.toMatch(/weiterMin\s*\+\s*eingabe\.pufferMinuten/);
    expect(quelle).not.toMatch(/-\s*pufferMinuten\s*-\s*anfahrtWeiter/);
  });
});

describe("Gelöschte Schüler verschwinden aus der Zuteilung", () => {
  const actions = readFileSync(join(process.cwd(), "src", "app", "admin", "actions.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const fn = (name: string) => {
    const a = actions.indexOf(`export async function ${name}`);
    return actions.slice(a, actions.indexOf("export async function", a + 10));
  };
  it("deaktivieren und endgültig löschen räumen beide die Zuteilung", () => {
    expect(fn("deleteSchueler")).toContain("entferneAusZuteilungen(adminClient, id)");
    expect(fn("hardDeleteSchueler")).toContain("entferneAusZuteilungen(adminClient, id)");
  });
});
