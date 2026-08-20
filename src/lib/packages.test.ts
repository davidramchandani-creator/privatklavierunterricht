import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cancellationSingleLessonPrice,
  computeCancellationSettlement,
  canCancelPackage,
  istAbo,
  paketBezeichnung,
  type Package,
} from "./packages";

function makePackage(overrides: Partial<Package> = {}): Package {
  return {
    id: "p1",
    student_id: "s1",
    type: "10er",
    lessons_total: 10,
    lessons_used: 0,
    name: null,
    price_per_lesson: 70,
    total_price: 700,
    payment_method: null,
    starts_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
    status: "active",
    paused: false,
    pause_remaining_seconds: null,
    paused_at: null,
    erstellt_am: new Date().toISOString(),
    ...overrides,
  };
}

describe("cancellationSingleLessonPrice", () => {
  it("10er und Einzellektion: 70 + max(0, preis - 60)", () => {
    expect(cancellationSingleLessonPrice(70, "10er")).toBe(80); // 70 + 10
    expect(cancellationSingleLessonPrice(60, "10er")).toBe(70); // 70 + 0
    expect(cancellationSingleLessonPrice(50, "10er")).toBe(70); // 70 + max(0,-10)
    expect(cancellationSingleLessonPrice(85, "single")).toBe(95); // 70 + 25
  });

  it("20er: Schwelle 55 statt 60", () => {
    // Der 20er-Lektionspreis ist von Haus aus tiefer, deshalb greift laut
    // Spezifikation eine tiefere Schwelle. Vorher wurde immer 60 gerechnet,
    // das ergab pro genutzter Lektion CHF 5 zu wenig.
    expect(cancellationSingleLessonPrice(65, "20er")).toBe(80); // 70 + 10
    expect(cancellationSingleLessonPrice(55, "20er")).toBe(70); // 70 + 0
    expect(cancellationSingleLessonPrice(65, "10er")).toBe(75); // zum Vergleich
  });

  it("ohne Typ gilt die 60er-Schwelle", () => {
    expect(cancellationSingleLessonPrice(65)).toBe(75);
  });
});

describe("computeCancellationSettlement", () => {
  it("Rückerstattung bei 2 genutzten Lektionen (10er @70)", () => {
    const pkg = makePackage({ price_per_lesson: 70, total_price: 700, lessons_total: 10 });
    const s = computeCancellationSettlement(pkg, 2);
    expect(s.singleLessonPrice).toBe(80);
    expect(s.usedCost).toBe(160); // 2 × 80
    expect(s.paidTotal).toBe(700);
    expect(s.refund).toBe(540); // 700 - 160
    expect(s.owed).toBe(0);
  });

  it("Nachzahlung möglich, wenn genutzte Lektionen teurer als Paketpreis", () => {
    const pkg = makePackage({ price_per_lesson: 70, total_price: 100, lessons_total: 10 });
    const s = computeCancellationSettlement(pkg, 2);
    expect(s.usedCost).toBe(160);
    expect(s.refund).toBe(0);
    expect(s.owed).toBe(60); // 160 - 100
  });

  it("fällt auf lessons_total × preis zurück, wenn total_price fehlt", () => {
    const pkg = makePackage({ price_per_lesson: 65, total_price: null, lessons_total: 10 });
    const s = computeCancellationSettlement(pkg, 1);
    expect(s.paidTotal).toBe(650);
    expect(s.singleLessonPrice).toBe(75);
    expect(s.refund).toBe(575);
  });
});

describe("canCancelPackage", () => {
  it("erlaubt bis einschliesslich 3 genutzte Lektionen", () => {
    const pkg = makePackage();
    expect(canCancelPackage(pkg, 0)).toBe(true);
    expect(canCancelPackage(pkg, 3)).toBe(true);
    expect(canCancelPackage(pkg, 4)).toBe(false);
  });

  it("verbietet bereits stornierte Pakete", () => {
    const pkg = makePackage({ status: "cancelled" });
    expect(canCancelPackage(pkg, 0)).toBe(false);
  });

  it("erlaubt pausierte Pakete", () => {
    const pkg = makePackage({ paused: true, pause_remaining_seconds: 1000 });
    expect(canCancelPackage(pkg, 1)).toBe(true);
  });

  it("verbietet null-Paket", () => {
    expect(canCancelPackage(null, 0)).toBe(false);
  });
});

describe("computeCancellationSettlement, 20er-Paket", () => {
  it("nutzt die 20er-Schwelle", () => {
    const pkg = makePackage({
      type: "20er",
      price_per_lesson: 65,
      total_price: 1300,
      lessons_total: 20,
    });
    const s = computeCancellationSettlement(pkg, 3, 325);
    expect(s.singleLessonPrice).toBe(80); // nicht 75
    expect(s.usedCost).toBe(240); // 3 × 80
    expect(s.paidTotal).toBe(325); // nur die Anzahlung
    expect(s.refund).toBe(85);
    expect(s.owed).toBe(0);
  });
});

describe("computeCancellationSettlement, Ratenzahlung", () => {
  const ratenPaket = () =>
    makePackage({ price_per_lesson: 70, total_price: 700, lessons_total: 10 });

  it("rechnet mit dem tatsächlich bezahlten Betrag, nicht mit dem Paketpreis", () => {
    // Schüler hat nur die Anzahlung von CHF 175 beglichen und 2 Lektionen genutzt.
    const s = computeCancellationSettlement(ratenPaket(), 2, 175);
    expect(s.paidTotal).toBe(175);
    expect(s.usedCost).toBe(160); // 2 × CHF 80 Einzelpreis
    expect(s.refund).toBe(15);
    expect(s.owed).toBe(0);
  });

  it("ohne den Parameter käme die alte, falsche Annahme heraus", () => {
    // Absicherung gegen einen Rückfall: ohne bezahlten Betrag wird weiterhin
    // der volle Paketpreis unterstellt, das darf die Abrechnung nie tun.
    const ohne = computeCancellationSettlement(ratenPaket(), 2);
    expect(ohne.refund).toBe(540);
    const mit = computeCancellationSettlement(ratenPaket(), 2, 175);
    expect(mit.refund).toBe(15);
    expect(ohne.refund).not.toBe(mit.refund);
  });

  it("Anzahlung plus erste Rate", () => {
    const s = computeCancellationSettlement(ratenPaket(), 2, 306.25);
    expect(s.refund).toBe(146.25);
    expect(s.owed).toBe(0);
  });

  it("noch nichts bezahlt ergibt eine Nachzahlung", () => {
    const s = computeCancellationSettlement(ratenPaket(), 2, 0);
    expect(s.refund).toBe(0);
    expect(s.owed).toBe(160);
  });

  it("Anzahlung bezahlt, keine Lektion genutzt: alles zurück", () => {
    const s = computeCancellationSettlement(ratenPaket(), 0, 175);
    expect(s.refund).toBe(175);
    expect(s.owed).toBe(0);
  });

  it("vollständig bezahltes Paket verhält sich wie bisher", () => {
    const s = computeCancellationSettlement(ratenPaket(), 2, 700);
    expect(s.refund).toBe(540);
  });
});

/**
 * Ein Abo darf nirgends „10er-Paket" heissen.
 *
 * In der Datenbank belegt ein Halbjahresabo das Feld `type` mit `10er` und
 * ein Jahresabo mit `20er`. Das ist eine Altlast aus dem Paketmodell, an der
 * Rechnungen, Raten und Buchungssperren hängen — sie bleibt.
 *
 * Sichtbar werden darf sie nicht. Ein Schüler mit einem Halbjahresabo über 19
 * Lektionen sah in der Liste „10er-Paket": falsche Bezeichnung, falsche Zahl.
 * Wer das liest, glaubt, er habe beim Anlegen danebengegriffen.
 */
describe("paketBezeichnung", () => {
  it("nennt ein Halbjahresabo beim Namen", () => {
    expect(
      paketBezeichnung({ type: "10er", abo_variante: "halbjahr", name: null })
    ).toBe("Halbjahresabo");
  });

  it("nennt ein Jahresabo beim Namen", () => {
    expect(
      paketBezeichnung({ type: "20er", abo_variante: "jahr", name: null })
    ).toBe("Jahresabo");
  });

  it("lässt echte Pakete unverändert", () => {
    expect(paketBezeichnung({ type: "10er", abo_variante: null })).toBe(
      "10er-Paket"
    );
    expect(paketBezeichnung({ type: "20er" })).toBe("20er-Paket");
    expect(paketBezeichnung({ type: "single" })).toBe("Einzellektion");
  });

  it("entscheidet über abo_variante, nicht über den Namen", () => {
    // Der gespeicherte Name kann veralten, etwa nach einem
    // Rhythmuswechsel. Die Variante ist die verlässliche Angabe.
    expect(
      paketBezeichnung({
        type: "10er",
        abo_variante: "halbjahr",
        name: "Irgendwas Altes",
      })
    ).toBe("Halbjahresabo");
  });

  it("kommt mit fehlendem Paket zurecht", () => {
    expect(paketBezeichnung(null)).toBe("Kein Paket");
    expect(paketBezeichnung(undefined)).toBe("Kein Paket");
  });

  it("unterscheidet Abo und Paket", () => {
    expect(istAbo({ abo_variante: "jahr" })).toBe(true);
    expect(istAbo({ abo_variante: "halbjahr" })).toBe(true);
    expect(istAbo({ abo_variante: null })).toBe(false);
    expect(istAbo(null)).toBe(false);
  });
});

/**
 * Kein Anzeigepfad darf am Typ hängen bleiben.
 *
 * Es genügt nicht, die Funktion zu haben — sie muss auch benutzt werden.
 * PACKAGE_LABELS direkt zu lesen ist genau der Fehler, der die Abos zu
 * Paketen gemacht hat, und er lässt sich beim nächsten neuen Bildschirm
 * mühelos wiederholen.
 */
describe("PACKAGE_LABELS wird nicht mehr direkt angezeigt", () => {
  it("kommt ausserhalb von packages.ts nicht mehr vor", () => {
    const wurzel = join(process.cwd(), "src");
    const suender: string[] = [];

    function durchsuche(pfad: string) {
      for (const eintrag of readdirSync(pfad, { withFileTypes: true })) {
        const voll = join(pfad, eintrag.name);
        if (eintrag.isDirectory()) {
          durchsuche(voll);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(eintrag.name)) continue;
        if (eintrag.name.startsWith("packages.")) continue;

        const quelle = readFileSync(voll, "utf8");
        if (/PACKAGE_LABELS\s*\[/.test(quelle)) {
          suender.push(voll.replace(wurzel, "src"));
        }
      }
    }

    durchsuche(wurzel);
    expect(
      suender,
      `Nutzt PACKAGE_LABELS direkt statt paketBezeichnung:\n${suender.join("\n")}`
    ).toEqual([]);
  });
});
