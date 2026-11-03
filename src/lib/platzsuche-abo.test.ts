// ============================================================
// Platzsuche beim Abo und bearbeitbare Zuteilung
//
// 3. November 2026, Hugo: „Freie Termine suchen" zeigte nur Freitag, obwohl
// Montag 16:15 und 20:00 in beiden Wochen 8 von 10 frei waren. Die Suche
// sortierte nach Quote und schnitt nach 40 ab, die Oberfläche zeigte davon
// die ersten 10. Freitag und Donnerstag am Nachmittag (ganz frei) füllten
// die Liste.
// ============================================================

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lies = (...p: string[]) =>
  readFileSync(join(process.cwd(), ...p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("Platzsuche", () => {
  const suche = lies("src", "lib", "fixplatz-suche.ts");
  it("kein Abschneiden nach Quote, jeder Tag kommt vor", () => {
    expect(suche).not.toMatch(/slice\(0,\s*params\.maxAngebote \?\? 40\)/);
    expect(suche).toMatch(/a\.weekday - b\.weekday/);
  });
  it("Schulferien werden übersprungen wie beim Abo", () => {
    expect(suche).toContain('.from("schulferien")');
    expect(suche).toMatch(/fixplatzSeriesStarts\(wunsch, ersterStart, ferien\)/);
  });

  const ui = lies("src", "app", "admin", "schueler", "[id]", "_components", "SchuelerDetailActions.tsx");
  it("die Oberfläche zeigt alle Treffer nach Tag und erlaubt eigene Eingabe", () => {
    expect(ui).not.toMatch(/angebote\.slice\(0,\s*10\)/);
    expect(ui).toContain("<DirektPlatz");
    expect(ui).toMatch(/step=\{300\}/);
  });
});

describe("Abo anlegen von Hand", () => {
  it("rechnet die Serie vor dem Anlegen und legt sonst nichts an", () => {
    const actions = lies("src", "app", "admin", "actions.ts");
    const a = actions.indexOf("export async function aboAnlegenAdmin");
    const fn = actions.slice(a, actions.indexOf("export async function", a + 10));
    const probe = fn.indexOf("planeFixplatzSerie(");
    const insert = fn.indexOf('.from("packages")\n    .insert(');
    expect(probe).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(-1);
    expect(probe).toBeLessThan(insert);
    expect(fn).toContain("Nichts angelegt, keine Mail.");
  });
});

describe("Zuteilung: freigegebene Einträge bleiben bearbeitbar", () => {
  it("Stift auch bei freigegebenen, mit neuer Serie dahinter", () => {
    const werkbank = lies("src", "app", "admin", "planung", "_components", "ZuteilungWerkbank.tsx");
    expect(werkbank).toContain("freigegebenenEintragAendern(");
    const fixZweig = werkbank.slice(werkbank.indexOf("{fix ? ("), werkbank.indexOf("<Lock", werkbank.indexOf("{fix ? (")));
    expect(fixZweig).toContain("setBearbeite(z.schuelerId)");

    const server = lies("src", "lib", "freigabe-server.ts");
    const a = server.indexOf("export async function aendereFreigegebenenEintrag");
    const fn = server.slice(a, server.indexOf("export async function", a + 10));
    expect(fn).toContain("setzeFestenPlatz(");
    expect(fn).toContain("setzeExternenTermin(");
    expect(fn).toContain("findeKonflikt(");
  });
});
