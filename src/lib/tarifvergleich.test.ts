import { describe, expect, it } from "vitest";
import {
  EIGENE_ANGEBOTE,
  LEKTION_MINUTEN,
  SMPV_STUNDE,
  SMPV_STUNDE_JUGEND,
  proStunde,
  vergleiche,
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
  it("gibt zu, dass die Einzellektion ueber der Empfehlung liegt", () => {
    const einzel = zeilen.find((z) => z.bezeichnung === "Einzellektion");
    expect(einzel?.preis60).toBe(113);
    expect(einzel?.unterEmpfehlung).toBe(false);
  });

  it("zeigt die Abos unter der Empfehlung", () => {
    const abos = zeilen.filter((z) => z.bezeichnung.includes("abo"));
    expect(abos).toHaveLength(2);
    for (const a of abos) expect(a.unterEmpfehlung).toBe(true);
  });

  it("rechnet den Jugendtarif des SMPV korrekt", () => {
    // 20 Prozent Reduktion auf 110 sind 88. Wichtig, weil das
    // Halbjahresabo mit 93 darueber liegt.
    expect(SMPV_STUNDE_JUGEND).toBe(88);
    expect(SMPV_STUNDE).toBe(110);
  });
});
