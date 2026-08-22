import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bauePrognose,
  erwarteterBetragProLektion,
  type ErwarteteEinnahme,
} from "./prognose";

/**
 * Der Kern der Prognose ist eine einzige Entscheidung: Erzeugt diese
 * Lektion noch eine Forderung, oder ist ihr Geld schon anderswo verbucht?
 *
 * David hatte die Idee als „Lektionen mal Preis" formuliert. Das stimmt
 * für Pakete mit Einzelabrechnung — und nur dafür. Diese Tests halten die
 * anderen Fälle fest, weil sie stillschweigend falsche Zahlen erzeugen
 * würden statt zu krachen.
 */
describe("Was eine Lektion an Forderung erzeugt", () => {
  it("pro Lektion abgerechnet: der Lektionspreis", () => {
    expect(
      erwarteterBetragProLektion({
        billing_mode: "pro_lektion",
        price_per_lesson: 70,
      })
    ).toBe(70);
  });

  it("einmalig bezahltes Paket: nichts", () => {
    // Sonst brächte ein 10er-Paket für 700 Franken im Kaufmonat 700 und
    // danach nochmals 70 pro Lektion — dasselbe Geld doppelt erwartet.
    expect(
      erwarteterBetragProLektion({
        billing_mode: "einmalig",
        price_per_lesson: 70,
      })
    ).toBe(0);
  });

  it("Ratenpaket und Abo: nichts, die Rate zählt", () => {
    // Abos laufen über dieselben Monatsraten wie Ratenpakete. Die Forderung
    // entsteht am Ratenstichtag, nicht an der Lektion.
    expect(
      erwarteterBetragProLektion({ billing_mode: "raten", price_per_lesson: 70 })
    ).toBe(0);
  });

  it("kein Paket: nichts über diesen Weg", () => {
    // Externe hängen an keinem Paket; ihr Betrag kommt aus dem Profil und
    // wird im Server-Teil gesondert behandelt.
    expect(erwarteterBetragProLektion(null)).toBe(0);
  });

  it("fehlender oder unsinniger Preis ergibt nichts, nicht NaN", () => {
    expect(
      erwarteterBetragProLektion({ billing_mode: "pro_lektion", price_per_lesson: null })
    ).toBe(0);
    expect(
      erwarteterBetragProLektion({
        billing_mode: "pro_lektion",
        price_per_lesson: "keine Zahl",
      })
    ).toBe(0);
  });
});

describe("Die drei Töpfe", () => {
  const posten: ErwarteteEinnahme[] = [
    { datum: "2026-08-10T15:00:00Z", betrag: 70, quelle: "lektion", bezeichnung: "Daniel" },
    { datum: "2026-08-24T15:00:00Z", betrag: 68, quelle: "extern", bezeichnung: "Justine" },
    { datum: "2026-09-01", betrag: 200, quelle: "rate", bezeichnung: "Angela — Rate 2" },
  ];

  it("zählt nur Posten des gefragten Monats", () => {
    const p = bauePrognose({ monat: "2026-08", bezahlt: 270, gestellt: 65, erwartet: posten });
    // Die Septemberrate bleibt draussen.
    expect(p.erwartet).toBe(138);
    expect(p.posten).toHaveLength(2);
  });

  it("das Total ist die Summe aller drei Töpfe", () => {
    const p = bauePrognose({ monat: "2026-08", bezahlt: 270, gestellt: 65, erwartet: posten });
    expect(p.total).toBe(270 + 65 + 138);
  });

  it("hält bezahlt und erwartet getrennt", () => {
    // Die wichtigste Eigenschaft überhaupt: Nur „bezahlt" ist belegt und
    // gehört in die Steuererklärung. Verschmölze das hier, wäre die
    // Trennung in der Abrechnung wertlos.
    const p = bauePrognose({ monat: "2026-08", bezahlt: 270, gestellt: 65, erwartet: posten });
    expect(p.bezahlt).toBe(270);
    expect(p.gestellt).toBe(65);
    expect(p.erwartet).not.toBe(p.total);
  });

  it("rundet auf Rappen", () => {
    const p = bauePrognose({
      monat: "2026-08",
      bezahlt: 0,
      gestellt: 0,
      erwartet: [
        { datum: "2026-08-05", betrag: 68.35, quelle: "extern", bezeichnung: "a" },
        { datum: "2026-08-06", betrag: 68.35, quelle: "extern", bezeichnung: "b" },
        { datum: "2026-08-07", betrag: 68.35, quelle: "extern", bezeichnung: "c" },
      ],
    });
    expect(p.erwartet).toBe(205.05);
  });

  it("sortiert die Posten nach Datum", () => {
    const p = bauePrognose({
      monat: "2026-08",
      bezahlt: 0,
      gestellt: 0,
      erwartet: [...posten].reverse(),
    });
    expect(p.posten.map((x) => x.bezeichnung)).toEqual(["Daniel", "Justine"]);
  });
});

describe("Verdrahtung", () => {
  const server = readFileSync(
    join(process.cwd(), "src", "lib", "prognose-server.ts"),
    "utf8"
  );

  it("lässt Testschüler aussen vor", () => {
    // Ein Probelauf darf die Zahlen für die Steuererklärung nicht anfassen.
    expect(server).toContain('eq("profiles.ist_test", false)');
  });

  it("zählt bestätigte externe Zahlungen nicht nochmals als erwartet", () => {
    // Sie stecken bereits im belegten Topf der Abrechnung.
    expect(server).toContain("schonBezahlt");
  });

  it("überspringt Raten, die schon eine Rechnung haben", () => {
    // Sonst stünden sie gleichzeitig unter „gestellt" und „erwartet".
    expect(server).toContain('is("invoice_id", null)');
  });

  it("nimmt die belegte Summe aus der Abrechnung statt sie neu zu rechnen", () => {
    expect(server).toContain("abrechnung.einnahmenTotal");
  });
});
