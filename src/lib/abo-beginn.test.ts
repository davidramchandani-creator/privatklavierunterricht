// ============================================================
// Beginn eines Abos wählbar (David, 3. November 2026)
//
// Bisher fest der Erste des nächsten Monats, und die Terminserie startete
// trotzdem ab heute. Jetzt ein Datumsfeld; Periode, Raten, Vorprüfung und
// Serie richten sich danach.
// ============================================================

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { firstSeriesStart } from "./fixplatz";
import { serienStart } from "./umstellung-server";

const ohne = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("Erster Termin ab Beginn", () => {
  it("Beginn Montag 16.11.: erster Montag-Termin ist der 16.11.", () => {
    const t = firstSeriesStart(
      { weekday: 1, time: "16:15", rhythmus: "woechentlich", lessons: 1 },
      serienStart("2026-11-16"),
      null
    );
    expect(t.toISOString()).toBe("2026-11-16T15:15:00.000Z");
  });
  it("Beginn Dienstag 17.11.: erster Montag ist der 23.11.", () => {
    const t = firstSeriesStart(
      { weekday: 1, time: "16:15", rhythmus: "woechentlich", lessons: 1 },
      serienStart("2026-11-17"),
      null
    );
    expect(t.toISOString().slice(0, 10)).toBe("2026-11-23");
  });
});

describe("Abo anlegen nutzt den Beginn überall", () => {
  const actions = ohne(readFileSync(join(process.cwd(), "src", "app", "admin", "actions.ts"), "utf8"));
  const fn = (name: string) => {
    const a = actions.indexOf(`export async function ${name}`);
    return actions.slice(a, actions.indexOf("export async function", a + 10));
  };
  it("Formularfeld wird gelesen und geprüft", () => {
    const f = fn("aboAnlegenAdmin");
    expect(f).toContain('aboBeginnAus(formData.get("periode_start"))');
    expect(f).not.toContain("naechsterPeriodenstart(todayInZurich())");
  });
  it("Vorprüfung und Serie starten ab dem Beginn, nicht ab heute", () => {
    const f = fn("aboAnlegenAdmin");
    expect(f.match(/now: serienStart\(periodeStart\)/g)?.length).toBe(2);
  });
  it("Vorschau und Suche bekommen den Beginn mit", () => {
    expect(fn("aboVorschauAdmin")).toContain("aboBeginnAus(params.beginn");
    expect(fn("fixplaetzeFuerSchueler")).toContain("aboBeginnAus(beginnRoh)");
  });
  it("Datumsfeld im Formular", () => {
    const ui = readFileSync(
      join(process.cwd(), "src", "app", "admin", "schueler", "[id]", "_components", "SchuelerDetailActions.tsx"),
      "utf8"
    );
    expect(ui).toMatch(/type="date"\s+name="periode_start"/);
    expect(ui).toContain("Erster Termin:");
  });
});
