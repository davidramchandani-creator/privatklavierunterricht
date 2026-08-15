import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANZAHL_BEWERTUNGEN,
  BEWERTUNGEN,
  SCHNITT_BEWERTUNG,
} from "./bewertungen";

/** Alle Quelldateien unter src/, ohne Tests. */
function quelldateien(ordner: string, treffer: string[] = []): string[] {
  for (const eintrag of readdirSync(ordner)) {
    const pfad = join(ordner, eintrag);
    if (statSync(pfad).isDirectory()) {
      quelldateien(pfad, treffer);
    } else if (/\.(ts|tsx)$/.test(eintrag) && !eintrag.includes(".test.")) {
      treffer.push(pfad);
    }
  }
  return treffer;
}

describe("Bewertungen", () => {
  it("hat keine doppelten IDs", () => {
    const ids = BEWERTUNGEN.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("jede Bewertung hat Text, Name und eine Sternzahl von 1 bis 5", () => {
    for (const b of BEWERTUNGEN) {
      expect(b.text.trim().length, `${b.id}: Text fehlt`).toBeGreaterThan(0);
      expect(b.name.trim().length, `${b.id}: Name fehlt`).toBeGreaterThan(0);
      expect(b.sterne, `${b.id}: Sterne`).toBeGreaterThanOrEqual(1);
      expect(b.sterne, `${b.id}: Sterne`).toBeLessThanOrEqual(5);
    }
  });

  it("der lange Wortlaut ist nie kürzer als der gekürzte", () => {
    // Wären sie vertauscht, stünde auf der Startseite die lange Fassung
    // und auf „Über mich" die kurze. Das fällt beim Lesen kaum auf.
    for (const b of BEWERTUNGEN) {
      if (!b.textLang) continue;
      expect(
        b.textLang.length,
        `${b.id}: textLang ist kürzer als text`,
      ).toBeGreaterThanOrEqual(b.text.length);
    }
  });

  it("der Schnitt wird gerechnet, nicht behauptet", () => {
    const erwartet = (
      BEWERTUNGEN.reduce((s, b) => s + b.sterne, 0) / BEWERTUNGEN.length
    ).toFixed(1);
    expect(SCHNITT_BEWERTUNG).toBe(erwartet);
    expect(ANZAHL_BEWERTUNGEN).toBe(BEWERTUNGEN.length);
  });

  /**
   * Der eigentliche Grund für diese Datei.
   *
   * „5.0 aus 4 Bewertungen" stand an zwei Stellen ausgeschrieben, im Hero
   * und auf „Über mich". Als die fünfte und sechste Bewertung dazukamen,
   * log die Seite an beiden Stellen weiter, und auffallen konnte es nicht:
   * Niemand zählt beim Lesen die Karten nach.
   *
   * Zahlen, die von einer Liste anderswo abhängen, gehören nicht in den
   * Fliesstext. Dieser Test lässt sie dort nicht wieder auftauchen.
   */
  it("nirgends steht die Anzahl der Bewertungen als feste Zahl", () => {
    const suender: string[] = [];
    for (const datei of quelldateien(join(process.cwd(), "src"))) {
      if (datei.endsWith(join("lib", "bewertungen.ts"))) continue;
      const inhalt = readFileSync(datei, "utf8");
      // Nur echte Ausgabe, nicht Kommentarzeilen darüber.
      for (const zeile of inhalt.split("\n")) {
        if (zeile.trimStart().startsWith("//") || zeile.trimStart().startsWith("*")) {
          continue;
        }
        if (/\b\d+\s+Bewertungen/.test(zeile)) {
          suender.push(`${datei}: ${zeile.trim()}`);
        }
      }
    }
    expect(suender, `Anzahl fest eingetippt:\n${suender.join("\n")}`).toEqual([]);
  });
});
