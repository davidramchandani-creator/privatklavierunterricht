import { describe, expect, it } from "vitest";
import { pricePerPersonFor } from "./group-courses";

/** Deine aktuelle Staffel: allein 70, zu zweit 55, ab dritt 45. */
const kurs = { price_tiers: { "1": 70, "2": 55, "3": 45 } };

describe("pricePerPersonFor", () => {
  it("trifft die hinterlegten Stufen", () => {
    expect(pricePerPersonFor(kurs, 1)).toBe(70);
    expect(pricePerPersonFor(kurs, 2)).toBe(55);
    expect(pricePerPersonFor(kurs, 3)).toBe(45);
  });

  it("über der höchsten Stufe gilt weiterhin der günstigste Preis", () => {
    expect(pricePerPersonFor(kurs, 4)).toBe(45);
    expect(pricePerPersonFor(kurs, 10)).toBe(45);
  });

  it("fällt bei 0 Teilnehmern auf die unterste Stufe zurück", () => {
    expect(pricePerPersonFor(kurs, 0)).toBe(70);
  });

  it("liefert 0, wenn keine brauchbare Staffel hinterlegt ist", () => {
    // Wichtig zu wissen: der Aufrufer muss diesen Fall abfangen, sonst
    // entstünde eine Rechnung über CHF 0. Siehe email-dispatch.ts.
    expect(pricePerPersonFor({ price_tiers: {} }, 2)).toBe(0);
    expect(
      pricePerPersonFor({ price_tiers: null as unknown as Record<string, number> }, 2)
    ).toBe(0);
    expect(
      pricePerPersonFor(
        { price_tiers: { a: "x" } as unknown as Record<string, number> },
        2
      )
    ).toBe(0);
  });

  it("ignoriert unbrauchbare Einträge, nutzt aber die gültigen", () => {
    const gemischt = {
      price_tiers: { "1": 70, x: "y", "2": 55 } as unknown as Record<string, number>,
    };
    expect(pricePerPersonFor(gemischt, 2)).toBe(55);
  });
});
