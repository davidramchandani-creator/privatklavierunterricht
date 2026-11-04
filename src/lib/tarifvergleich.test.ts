import { describe, expect, it } from "vitest";
import {
  EIGENE_ANGEBOTE,
  LEKTION_MINUTEN,
  SMPV_STUNDE,
  SMPV_STUNDE_JUGEND,
  proStunde,
  vergleiche,
  vergleichsSatz,
} from "./tarifvergleich";

describe("proStunde", () => {
  it("rechnet 45 Minuten auf 60 hoch", () => {
    // 65 fuer 45 Minuten sind 86.67 fuer eine Stunde, gerundet 87.
    expect(proStunde(65)).toBe(87);
    expect(proStunde(70)).toBe(93);
    expect(proStunde(85)).toBe(113);
  });

  it("laesst einen Stundenpreis unveraendert", () => {
    expect(proStunde(LEKTION_MINUTEN === 45 ? 90 : 0)).toBe(120);
  });
});

describe("vergleiche", () => {
  const zeilen = vergleiche(EIGENE_ANGEBOTE);

  it("stellt jedes Angebot auf dieselbe Dauer wie der SMPV", () => {
    for (const z of zeilen) {
      expect(z.preis60).toBe(proStunde(z.preis45));
      expect(z.preis60).toBeGreaterThan(z.preis45);
    }
  });

  /**
   * Der Punkt, an dem der Vergleich haette schoengerechnet werden koennen.
   *
   * CHF 65 neben CHF 110 zu stellen sieht nach einem Drittel Ersparnis aus.
   * Auf dieselbe Dauer gebracht sind es CHF 87 gegen CHF 110, und die
   * Einzellektion liegt sogar darueber. Dieser Test haelt fest, dass die
   * Seite das zugibt, statt es wegzurunden.
   */
  it("gibt zu, was ueber der Empfehlung liegt", () => {
    // Neue Preise ab 4. November 2026: 95 / 80 / 75 fuer 45 Minuten.
    const einzel = zeilen.find((z) => z.bezeichnung === "Einzellektion");
    const semester = zeilen.find((z) => z.bezeichnung === "Semesterabo");
    const jahr = zeilen.find((z) => z.bezeichnung === "Jahresabo");
    expect(einzel?.preis60).toBe(127);
    expect(semester?.preis60).toBe(107);
    expect(jahr?.preis60).toBe(100);
    expect(einzel?.unterEmpfehlung).toBe(false);
    expect(semester?.unterEmpfehlung).toBe(true);
    expect(jahr?.unterEmpfehlung).toBe(true);
  });

  it("baut den Satz unter der Tabelle aus den Zahlen", () => {
    expect(vergleichsSatz(zeilen)).toBe(
      "Semesterabo und Jahresabo liegen damit unter der Empfehlung, Einzellektion darüber."
    );
    // Liegt ein Preis genau auf der Empfehlung, sagt der Satz das.
    expect(
      vergleichsSatz(vergleiche([
        { bezeichnung: "Einzellektion", preis45: 97.5 },
        { bezeichnung: "Semesterabo", preis45: 82.5 },
        { bezeichnung: "Jahresabo", preis45: 77.5 },
      ]))
    ).toBe(
      "Semesterabo entspricht damit genau der Empfehlung, Jahresabo liegt darunter, Einzellektion darüber."
    );
    expect(
      vergleichsSatz(vergleiche([
        { bezeichnung: "Einzellektion", preis45: 85 },
        { bezeichnung: "Semesterabo", preis45: 70 },
        { bezeichnung: "Jahresabo", preis45: 65 },
      ]))
    ).toBe(
      "Semesterabo und Jahresabo liegen damit unter der Empfehlung, Einzellektion darüber."
    );
  });

  it("rechnet den Jugendtarif des SMPV korrekt", () => {
    // 20 Prozent Reduktion auf 110 sind 88. Wichtig, weil das
    // Halbjahresabo mit 93 darueber liegt.
    expect(SMPV_STUNDE_JUGEND).toBe(88);
    expect(SMPV_STUNDE).toBe(110);
  });
});
