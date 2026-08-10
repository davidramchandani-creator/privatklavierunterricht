import { describe, expect, it } from "vitest";
import {
  addTermMonths,
  buildPlanForRhythmus,
  computeRhythmusChange,
  expiryFor,
  flexMehrkosten,
  intervalDaysFor,
  isoWeek,
  nextMatchingDate,
  priceWithBookingMode,
  rescheduleOpenInstalments,
  termMonthsForType,
  weekParity,
  type Rhythmus,
} from "./rhythmus";

// Daves Vorgabe, wörtlich:
//   10er wöchentlich      →  4 Monate
//   10er zweiwöchentlich  →  6 Monate
//   20er wöchentlich      →  8 Monate
//   20er zweiwöchentlich  → 12 Monate
describe("Laufzeit nach Pakettyp und Rhythmus", () => {
  it("trifft alle vier vereinbarten Laufzeiten exakt", () => {
    expect(termMonthsForType("10er", "woechentlich")).toBe(4);
    expect(termMonthsForType("10er", "zweiwoechentlich")).toBe(6);
    expect(termMonthsForType("20er", "woechentlich")).toBe(8);
    expect(termMonthsForType("20er", "zweiwoechentlich")).toBe(12);
  });

  it("setzt das Ablaufdatum entsprechend", () => {
    expect(expiryFor(10, "woechentlich", "2026-08-09")).toBe("2026-12-09");
    expect(expiryFor(10, "zweiwoechentlich", "2026-08-09")).toBe("2027-02-09");
    expect(expiryFor(20, "woechentlich", "2026-08-09")).toBe("2027-04-09");
    expect(expiryFor(20, "zweiwoechentlich", "2026-08-09")).toBe("2027-08-09");
  });

  it("hat den passenden Serienabstand", () => {
    expect(intervalDaysFor("woechentlich")).toBe(7);
    expect(intervalDaysFor("zweiwoechentlich")).toBe(14);
  });
});

describe("addTermMonths – gebrochene Laufzeiten", () => {
  it("verhält sich bei ganzen Monaten wie addMonths", () => {
    expect(addTermMonths("2026-08-09", 4)).toBe("2026-12-09");
    expect(addTermMonths("2026-08-09", 0)).toBe("2026-08-09");
  });

  it("rechnet den gebrochenen Anteil in Tage um", () => {
    // 0.4 Monate ≈ 12 Tage
    expect(addTermMonths("2026-08-09", 0.4)).toBe("2026-08-21");
    // 4.2 Monate = 4 Monate + 6 Tage
    expect(addTermMonths("2026-10-09", 4.2)).toBe("2027-02-15");
  });

  it("rutscht am Monatsende nicht in den Folgemonat", () => {
    // 31. Januar + 1 Monat gibt es nicht – muss auf den 28. klemmen.
    expect(addTermMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("Ratenplan folgt dem Rhythmus", () => {
  const faelle: Array<{
    typ: "10er" | "20er";
    preis: number;
    rhythmus: Rhythmus;
    raten: number;
    anzahlung: number;
  }> = [
    { typ: "10er", preis: 700, rhythmus: "woechentlich", raten: 4, anzahlung: 175 },
    { typ: "10er", preis: 700, rhythmus: "zweiwoechentlich", raten: 6, anzahlung: 175 },
    { typ: "20er", preis: 1300, rhythmus: "woechentlich", raten: 8, anzahlung: 325 },
    { typ: "20er", preis: 1300, rhythmus: "zweiwoechentlich", raten: 12, anzahlung: 325 },
  ];

  for (const f of faelle) {
    it(`${f.typ} ${f.rhythmus}: Anzahlung ${f.anzahlung} + ${f.raten} Raten`, () => {
      const plan = buildPlanForRhythmus(f.typ, f.preis, "2026-08-09", f.rhythmus);
      expect(plan.depositAmount).toBe(f.anzahlung);
      expect(plan.instalmentCount).toBe(f.raten);
      expect(plan.entries).toHaveLength(f.raten + 1);
    });
  }

  it("ändert den Gesamtpreis nie – nur die Verteilung", () => {
    for (const f of faelle) {
      const plan = buildPlanForRhythmus(f.typ, f.preis, "2026-08-09", f.rhythmus);
      const summe = plan.entries.reduce((s, e) => s + e.amount, 0);
      expect(Math.round(summe * 100) / 100).toBe(f.preis);
    }
  });

  it("macht zweiwöchentlich kleinere Raten als wöchentlich", () => {
    const woe = buildPlanForRhythmus("10er", 700, "2026-08-09", "woechentlich");
    const zwei = buildPlanForRhythmus("10er", 700, "2026-08-09", "zweiwoechentlich");
    expect(woe.instalmentAmount).toBe(131.25);
    expect(zwei.instalmentAmount).toBe(87.5);
    expect(zwei.instalmentAmount).toBeLessThan(woe.instalmentAmount);
  });
});

describe("Rhythmuswechsel mitten im Paket", () => {
  const heute = "2026-10-09";

  it("wöchentlich → zweiwöchentlich verlängert nach Restlektionen", () => {
    const c = computeRhythmusChange({
      von: "woechentlich",
      nach: "zweiwoechentlich",
      lessonsRemaining: 7,
      today: heute,
      bisherigesAblaufdatum: "2026-12-09",
    });
    expect(c.restMonate).toBe(4.2);
    expect(c.neuesAblaufdatum).toBe("2027-02-15");
    expect(c.differenzTage).toBe(68);
    expect(c.neuerAbstandTage).toBe(14);
  });

  it("zweiwöchentlich → wöchentlich verkürzt entsprechend", () => {
    const c = computeRhythmusChange({
      von: "zweiwoechentlich",
      nach: "woechentlich",
      lessonsRemaining: 7,
      today: heute,
      bisherigesAblaufdatum: "2027-02-09",
    });
    expect(c.restMonate).toBe(2.8);
    expect(c.neuesAblaufdatum).toBe("2027-01-02");
    expect(c.differenzTage).toBe(-38);
    expect(c.neuerAbstandTage).toBe(7);
  });

  it("nimmt beim Wechsel auf den langsameren Rhythmus nie Zeit weg", () => {
    // Mit 1 Restlektion ergäbe die reine Rechnung 0.6 Monate = 43 Tage
    // *weniger* als bisher. Wer auf zweiwöchentlich wechselt, will aber mehr
    // Zeit, nicht weniger – das bisherige Datum bleibt stehen.
    const c = computeRhythmusChange({
      von: "woechentlich",
      nach: "zweiwoechentlich",
      lessonsRemaining: 1,
      today: heute,
      bisherigesAblaufdatum: "2026-12-09",
    });
    expect(c.bisherigesDatumGeschuetzt).toBe(true);
    expect(c.neuesAblaufdatum).toBe("2026-12-09");
    expect(c.differenzTage).toBe(0);
  });

  it("lässt sich nicht ausnutzen: später wechseln bringt weniger", () => {
    // Wer früh wechselt (viele Restlektionen), bekommt viel Zeit dazu.
    // Wer spät wechselt, bekommt wenig – die Zeit hängt an den Lektionen,
    // nicht am Wechselzeitpunkt.
    const frueh = computeRhythmusChange({
      von: "woechentlich",
      nach: "zweiwoechentlich",
      lessonsRemaining: 10,
      today: heute,
      bisherigesAblaufdatum: "2026-12-09",
    });
    const spaet = computeRhythmusChange({
      von: "woechentlich",
      nach: "zweiwoechentlich",
      lessonsRemaining: 4,
      today: heute,
      bisherigesAblaufdatum: "2026-12-09",
    });
    expect(frueh.differenzTage).toBeGreaterThan(spaet.differenzTage);
  });

  it("behandelt 0 Restlektionen wie 1 – nie sofort abgelaufen", () => {
    const c = computeRhythmusChange({
      von: "zweiwoechentlich",
      nach: "woechentlich",
      lessonsRemaining: 0,
      today: heute,
      bisherigesAblaufdatum: "2027-02-09",
    });
    expect(c.neuesAblaufdatum > heute).toBe(true);
  });
});

describe("Offene Raten nach dem Wechsel neu verteilen", () => {
  const offen = [
    { id: "a", sequence: 3, amount: 131.25, dueDate: "2026-11-09" },
    { id: "b", sequence: 4, amount: 131.25, dueDate: "2026-12-09" },
  ];

  it("streckt bei längerer Laufzeit, ohne die Summe zu ändern", () => {
    const r = rescheduleOpenInstalments(offen, "2027-02-09", "2026-10-09");
    const summe = r.reduce((s, e) => s + e.neuerBetrag, 0);
    expect(Math.round(summe * 100) / 100).toBe(262.5);
    expect(r).toHaveLength(2);
    // Beide Raten rücken nach hinten.
    expect(r[1].neuesFaelligkeitsdatum > "2026-12-09").toBe(true);
  });

  it("legt Raten zusammen, wenn die Laufzeit kürzer wird", () => {
    const r = rescheduleOpenInstalments(offen, "2026-11-09", "2026-10-09");
    const summe = r.reduce((s, e) => s + e.neuerBetrag, 0);
    expect(Math.round(summe * 100) / 100).toBe(262.5);
    // Eine Rate trägt alles, die andere fällt auf 0 (wird storniert).
    expect(r[0].neuerBetrag).toBe(262.5);
    expect(r[1].neuerBetrag).toBe(0);
  });

  it("legt nie mehr Raten an als vereinbart", () => {
    // Auch bei sehr langer Restlaufzeit bleiben es höchstens 2 Raten.
    const r = rescheduleOpenInstalments(offen, "2028-01-01", "2026-10-09");
    expect(r.filter((e) => e.neuerBetrag > 0)).toHaveLength(2);
  });

  it("kommt mit einer leeren Liste klar", () => {
    expect(rescheduleOpenInstalments([], "2027-02-09", "2026-10-09")).toEqual([]);
  });
});

describe("Flex-Aufschlag", () => {
  it("lässt den Fixplatz beim Grundpreis", () => {
    expect(priceWithBookingMode(70, "fix")).toBe(70);
    expect(priceWithBookingMode(65, "fix")).toBe(65);
  });

  it("schlägt bei Flex 10 % auf", () => {
    expect(priceWithBookingMode(70, "flex")).toBe(77);
    expect(priceWithBookingMode(65, "flex")).toBe(71.5);
  });

  it("beziffert die Mehrkosten über das ganze Paket", () => {
    expect(flexMehrkosten(70, 10)).toBe(70);
    expect(flexMehrkosten(65, 20)).toBe(130);
  });

  it("respektiert einen abweichenden Aufschlag", () => {
    expect(priceWithBookingMode(70, "flex", 20)).toBe(84);
  });
});

describe("Kalenderwoche und Parität", () => {
  it("bestimmt die ISO-Woche", () => {
    // 2026-01-01 ist ein Donnerstag → KW 1.
    expect(isoWeek(new Date("2026-01-01T00:00:00Z"))).toBe(1);
  });

  it("wechselt die Parität jede Woche", () => {
    const a = weekParity(new Date("2026-08-10T00:00:00Z"));
    const b = weekParity(new Date("2026-08-17T00:00:00Z"));
    const c = weekParity(new Date("2026-08-24T00:00:00Z"));
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).toBe(c);
  });

  it("findet den nächsten passenden Tag samt Parität", () => {
    const von = new Date("2026-08-09T00:00:00Z"); // Sonntag
    // Dienstag = 2
    const p1 = nextMatchingDate(von, 2, 1);
    const p0 = nextMatchingDate(von, 2, 0);
    expect(p1.toISOString().slice(0, 10)).toBe("2026-08-11");
    expect(p0.toISOString().slice(0, 10)).toBe("2026-08-18");
    expect(p1.getUTCDay()).toBe(2);
    expect(p0.getUTCDay()).toBe(2);
  });

  it("ignoriert die Parität, wenn keine verlangt ist", () => {
    const d = nextMatchingDate(new Date("2026-08-09T00:00:00Z"), 2, null);
    expect(d.toISOString().slice(0, 10)).toBe("2026-08-11");
  });
});
