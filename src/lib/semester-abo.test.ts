// ============================================================
// Abos im Semesterrhythmus (David, 3. November 2026)
//
// Die Zahlen hier sind die, die David vor dem Umbau abgesegnet hat.
// ============================================================

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { aboPeriode, anzahlMonatsraten, baueAboAngebot, type Semester } from "./abo";
import { firstSeriesStart, fixplatzSeriesStarts } from "./fixplatz";
import { serienStart } from "./umstellung-server";

const SEMESTER: Semester[] = [
  { bezeichnung: "HS26 / WZ27", beginn: "2026-09-14", ende: "2027-02-21" },
  { bezeichnung: "FS27 / SZ27", beginn: "2027-02-22", ende: "2027-09-12" },
];
const FREI = [
  { bezeichnung: "Herbstferien 2026", start: "2026-10-05", ende: "2026-10-16" },
  { bezeichnung: "Weihnachtsferien 2026/27", start: "2026-12-21", ende: "2027-01-03" },
  { bezeichnung: "Praktikum 1", start: "2027-01-18", ende: "2027-02-07" },
  { bezeichnung: "Osterferien 2027", start: "2027-03-29", ende: "2027-04-04" },
  { bezeichnung: "Sommerferien 2027", start: "2027-07-26", ende: "2027-08-15" },
];

/** Lektionen eines festen Platzes vom Beginn bis Semesterende. */
function lektionen(start: string, wt: number, zeit: string, rh: "woechentlich" | "zweiwoechentlich", par: 0 | 1 | null): number {
  const wunsch = { weekday: wt, time: zeit, rhythmus: rh, lessons: 120 };
  const erster = firstSeriesStart(wunsch, serienStart(start), par);
  const ende = Date.parse("2027-02-21T23:59:59Z");
  return fixplatzSeriesStarts(wunsch, erster, FREI.map((f) => ({ start: f.start, ende: f.ende }))).filter(
    (d) => d.getTime() <= ende
  ).length;
}

describe("Laufzeit nach Semester", () => {
  it("Semesterabo endet am Ende des Semesters, in dem es beginnt", () => {
    const p = aboPeriode({ variante: "halbjahr", start: "2026-11-04", semester: SEMESTER })!;
    expect(p.ende).toBe("2027-02-21");
    expect(p.bindungBis).toBe("2027-02-21");
    expect(p.laufzeitMonate).toBe(4);
  });
  it("Jahresabo: pro Semester abgerechnet, gebunden bis Ende des nächsten", () => {
    const p = aboPeriode({ variante: "jahr", start: "2026-11-04", semester: SEMESTER })!;
    expect(p.ende).toBe("2027-02-21");
    expect(p.bindungBis).toBe("2027-09-12");
  });
  it("Verlängerung des Jahresabos ins zweite Semester behält die Bindung", () => {
    const p = aboPeriode({ variante: "jahr", start: "2027-02-22", semester: SEMESTER, bisherigeBindung: "2027-09-12" })!;
    expect(p.ende).toBe("2027-09-12");
    expect(p.bindungBis).toBe("2027-09-12");
  });
  it("Raten nur, solange die Fälligkeit im Semester liegt", () => {
    expect(anzahlMonatsraten("2026-09-14", "2027-02-21")).toBe(6);
    expect(anzahlMonatsraten("2027-02-22", "2027-09-12")).toBe(7);
  });
  it("ohne hinterlegtes Semester: null, die alte Laufzeit greift", () => {
    expect(aboPeriode({ variante: "halbjahr", start: "2028-03-01", semester: SEMESTER })).toBeNull();
  });
  it("später einsteigen: nur die verbleibenden Lektionen", () => {
    const p = aboPeriode({ variante: "halbjahr", start: "2026-11-09", semester: SEMESTER });
    const a = baueAboAngebot({
      variante: "halbjahr",
      rhythmus: "woechentlich",
      weekday: 1,
      periodeStart: "2026-11-09",
      preisProLektion: 70,
      ferien: FREI,
      periode: p,
    });
    // Mo 9.11. bis 21.2.: 15 Montage, ohne 21.12., 28.12., 18.1., 25.1., 1.2.
    expect(a.lektionen).toBe(10);
    expect(a.periodeEnde).toBe("2027-02-21");
    expect(a.laufzeitMonate).toBe(4);
  });
});

describe("Die abgesegnete Tabelle", () => {
  it.each([
    ["Angela", "2026-09-14", 4, "16:00", "woechentlich", null, 16],
    ["Flurina", "2026-09-14", 4, "17:00", "woechentlich", null, 16],
    ["Daniel", "2026-09-14", 1, "17:15", "zweiwoechentlich", 0, 8],
    ["Emilie", "2026-09-21", 1, "18:15", "zweiwoechentlich", 1, 8],
    ["Maurice", "2026-09-14", 4, "18:00", "zweiwoechentlich", 0, 8],
    ["Marina", "2026-09-14", 1, "17:15", "zweiwoechentlich", 1, 8],
    ["Hugo", "2026-11-04", 1, "18:10", "zweiwoechentlich", 0, 5],
  ] as const)("%s: %i Lektionen", (_n, start, wt, zeit, rh, par, soll) => {
    expect(lektionen(start, wt, zeit, rh, par)).toBe(soll);
  });
});

describe("Verdrahtung", () => {
  const lies = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
  it("Vorschau rechnet nach Semester, Verlängerung behält die Bindung", () => {
    expect(lies("src", "lib", "abo-server.ts")).toMatch(/periode: aboPeriode\(/);
    expect(lies("src", "lib", "subscription-jobs.ts")).toContain("bisherigeBindung: pkg.bindung_bis");
  });
  it("Jahresabo im ersten Semester lässt sich nicht kündigen und verlängert sich", () => {
    expect(lies("src", "app", "schueler", "portal", "actions.ts")).toContain("Dein Jahresabo läuft bis");
    expect(lies("src", "lib", "subscription-jobs.ts")).toMatch(/if \(!pkg\.auto_renew && !gebunden\) continue;/);
  });
  it("Umstellung schreibt erst auf Klick, Mail nur mit Häkchen", () => {
    const ui = lies("src", "app", "admin", "schulferien", "umstellung", "_components", "UmstellungBoard.tsx");
    expect(ui).toContain("aboUmstellen(z.packageId, mitMail)");
    const page = lies("src", "app", "admin", "schulferien", "umstellung", "page.tsx");
    expect(page).not.toContain("fuehreUmstellungAus");
  });
  it("Ganztägige Kalendereinträge sperren nichts", () => {
    expect(lies("src", "lib", "booking-server.ts")).toContain('!(b.quelle === "apple" && istGanztaegig(b))');
  });
});
