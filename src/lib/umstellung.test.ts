import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serienStart } from "./umstellung-server";

/**
 * Die Serie muss am Stichtag beginnen dürfen, nicht einen Tag später.
 *
 * `bookFixplatzSeries` verlangt 24 Stunden Vorlauf ab dem übergebenen
 * Zeitpunkt. Wird dort versehentlich der Stichtag selbst übergeben, rutscht
 * die erste Lektion eine ganze Woche nach hinten, weil der nächste passende
 * Wochentag erst dann wieder kommt. Das fiele niemandem auf, ausser dem
 * Schüler, der eine Woche zu spät anfängt und trotzdem ab dem Stichtag zahlt.
 */
describe("serienStart", () => {
  it("liegt genau 24 Stunden vor dem Stichtag", () => {
    const start = serienStart("2026-09-14");
    expect(start.toISOString()).toBe("2026-09-13T00:00:00.000Z");
  });

  it("erlaubt damit einen Termin am Stichtag selbst", () => {
    // Die Regel in firstSeriesStart lautet: frühestens = now + 24h.
    const start = serienStart("2026-09-14");
    const fruehestens = start.getTime() + 24 * 3600 * 1000;
    expect(fruehestens).toBe(Date.parse("2026-09-14T00:00:00.000Z"));
  });

  it("verschiebt nichts über Monatsgrenzen hinweg", () => {
    expect(serienStart("2026-10-01").toISOString()).toBe(
      "2026-09-30T00:00:00.000Z"
    );
  });
});

/**
 * Der zugesicherte Preis muss halten.
 *
 * Beim Ausfüllen kennt der Schüler seinen Wochentag noch nicht; gerechnet
 * wird über den ungünstigsten seiner angegebenen Tage. Würde beim Anwenden
 * mit dem tatsächlich zugeteilten Tag neu gerechnet, stünde auf der Rechnung
 * unter Umständen eine Lektion und ein Monatsbetrag mehr als in dem, was er
 * bestätigt hat.
 *
 * Das ist eine Zusicherung an den Schüler und lässt sich nicht als Zahl
 * prüfen, ohne die halbe Datenbank nachzubauen. Geprüft wird deshalb, dass
 * die Stelle im Code steht, die sie herstellt: der Preis kommt aus
 * `baueVorschauOhneTermin` mit den **angegebenen Tagen**, nicht aus einer
 * Rechnung über den zugeteilten Wochentag.
 */
describe("Preiszusicherung beim Anwenden", () => {
  const quelle = readFileSync(
    join(process.cwd(), "src", "lib", "umstellung-server.ts"),
    "utf8"
  );

  it("rechnet den Preis über die angegebenen Tage, nicht über den zugeteilten", () => {
    expect(quelle).toContain("baueVorschauOhneTermin");

    // Der Block, der das Paket anlegt, muss die zugesicherten Werte nehmen.
    const insert = quelle.slice(quelle.indexOf(".insert({"));
    expect(insert).toContain("total_price: zugesichert.gesamtpreis");
    expect(insert).toContain("price_per_lesson: zugesichert.preisProLektion");
    expect(insert).toContain("abo_lektionen: zugesichert.lektionen");
    expect(insert).toContain("monatsbetrag: zugesichert.monatsbetrag");
  });

  it("bucht nur die zugesicherte Lektionszahl", () => {
    expect(quelle).toContain("lessons: zugesichert.lektionen");
  });

  it("legt ohne Wahl kein Abo an", () => {
    // Wer nicht geantwortet hat, darf nicht stillschweigend ein Abo bekommen.
    expect(quelle).toContain("Hat kein Abo gewählt.");
    expect(quelle).toMatch(/if \(!wahl\?\.abo_variante \|\| !wahl\?\.abo_rhythmus\)/);
  });

  it("beendet das alte Paket, bevor das neue entsteht", () => {
    const altPos = quelle.indexOf('status: "expired"');
    const neuPos = quelle.indexOf(".insert({");
    expect(altPos).toBeGreaterThan(-1);
    expect(neuPos).toBeGreaterThan(-1);
    expect(altPos).toBeLessThan(neuPos);
  });
});

/**
 * Die Umstellungsrunde muss allen sichtbar sein.
 *
 * Eine gewöhnliche Runde wird Schülern ohne Fixplatz absichtlich nicht
 * gezeigt. Bei der Umstellung hat definitionsgemäss niemand einen, und ohne
 * Ausnahme sähe kein einziger Schüler das Formular. Der Fehler wäre
 * lautlos: keine Meldung, keine Antworten, eine leere Runde.
 */
describe("Sichtbarkeit im Portal", () => {
  it("nimmt Umstellungsrunden vom Fixplatz-Filter aus", () => {
    const quelle = readFileSync(
      join(process.cwd(), "src", "app", "schueler", "portal", "actions.ts"),
      "utf8"
    );
    expect(quelle).toContain('allgemein.art !== "umstellung"');
  });
});
