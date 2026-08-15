import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEER, rechneDaten } from "./bewertungen";

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

function zeile(over: Partial<Parameters<typeof rechneDaten>[0][number]> = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    sterne: 5,
    text: "Sehr schoen.",
    text_kurz: null,
    name: "Testperson",
    ...over,
  };
}

describe("rechneDaten", () => {
  it("gibt bei nichts einen leeren Stand zurueck", () => {
    expect(rechneDaten([])).toEqual(LEER);
  });

  it("rechnet den Schnitt, statt ihn zu behaupten", () => {
    const daten = rechneDaten([
      zeile({ sterne: 5 }),
      zeile({ sterne: 4 }),
      zeile({ sterne: 5 }),
    ]);
    expect(daten.schnitt).toBe("4.7");
  });

  /**
   * Der Fall, um den David ausdruecklich gebeten hat.
   *
   * Zwei Leute haben im alten System fuenf Sterne gegeben und nichts
   * geschrieben. Ihre Wertung zaehlt, denn sie wurde abgegeben. Eine Karte
   * bekommen sie nicht, weil ein leeres Zitatfeld nach Fehler aussieht.
   */
  it("zaehlt Sterne ohne Text mit, zeigt sie aber nicht", () => {
    const daten = rechneDaten([
      zeile({ text: "Mit Text.", name: "Jan" }),
      zeile({ text: null, name: null }),
      zeile({ text: null, name: null }),
    ]);
    expect(daten.anzahl).toBe(3);
    expect(daten.liste).toHaveLength(1);
    expect(daten.liste[0].name).toBe("Jan");
  });

  it("zeigt keinen Text ohne Namen", () => {
    // Ein Zitat ohne Absender wirkt erfunden. Die Datenbank verbietet es
    // ohnehin, hier faellt es zusaetzlich nicht durch.
    const daten = rechneDaten([zeile({ text: "Anonym gelobt.", name: null })]);
    expect(daten.liste).toHaveLength(0);
    expect(daten.anzahl).toBe(1);
  });

  it("reicht die Kurzfassung durch, wenn es eine gibt", () => {
    const daten = rechneDaten([
      zeile({ text: "Langer Text mit viel Drumherum.", text_kurz: "Kurz." }),
      zeile({ text: "Nur lang." }),
    ]);
    expect(daten.liste[0].textKurz).toBe("Kurz.");
    expect(daten.liste[1].textKurz).toBe(null);
  });

  it("behaelt die Reihenfolge, in der die Datenbank liefert", () => {
    const daten = rechneDaten([
      zeile({ name: "Erste" }),
      zeile({ name: "Zweite" }),
      zeile({ name: "Dritte" }),
    ]);
    expect(daten.liste.map((b) => b.name)).toEqual([
      "Erste",
      "Zweite",
      "Dritte",
    ]);
  });
});

/**
 * Der eigentliche Grund fuer diese Datei.
 *
 * „5.0 aus 4 Bewertungen" stand an zwei Stellen ausgeschrieben, im Hero und
 * auf „Ueber mich". Als die fuenfte und sechste dazukamen, log die Seite an
 * beiden Stellen weiter, und auffallen konnte es nicht: Niemand zaehlt beim
 * Lesen die Karten nach.
 *
 * Zahlen, die von Daten anderswo abhaengen, gehoeren nicht in den
 * Fliesstext. Dieser Test laesst sie dort nicht wieder auftauchen.
 */
describe("Anzahl im Text", () => {
  it("steht nirgends als feste Zahl", () => {
    const suender: string[] = [];
    for (const datei of quelldateien(join(process.cwd(), "src"))) {
      const inhalt = readFileSync(datei, "utf8");
      for (const z of inhalt.split("\n")) {
        const roh = z.trimStart();
        if (roh.startsWith("//") || roh.startsWith("*")) continue;
        if (/\b\d+\s+Bewertungen/.test(z)) suender.push(`${datei}: ${z.trim()}`);
      }
    }
    expect(suender, `Anzahl fest eingetippt:\n${suender.join("\n")}`).toEqual([]);
  });
});

/**
 * Die Abfrage muss nach Freigabe filtern.
 *
 * Die Datenbank haelt dicht, auch ohne diesen Filter: Row Level Security
 * gibt anonymen Lesern nur freigegebene Zeilen heraus, das ist geprueft.
 * Nur liest die Startseite nicht immer anonym. Faellt der Filter weg und
 * rendert die Seite einmal mit einer angemeldeten Admin-Sitzung, stehen
 * plaetzlich auch abgelehnte Bewertungen darauf.
 *
 * Zwei Schloesser an derselben Tuer, und dieses hier faellt beim Loeschen
 * auf.
 */
describe("ladeBewertungen", () => {
  it("fragt nur freigegebene ab", () => {
    const quelle = readFileSync(
      join(process.cwd(), "src", "lib", "bewertungen.ts"),
      "utf8",
    );
    expect(quelle).toContain('.eq("status", "freigegeben")');
  });
});
