import { describe, expect, it } from "vitest";
import {
  ABO_KUENDIGUNGSFRIST_TAGE,
  ABO_LAUFZEIT_MONATE,
  baueAboAngebot,
  baueMonatsraten,
  berechneAboTermine,
  istFerientag,
  istKuendbar,
  kuendigungsfrist,
  periodenEnde,
  type Ferienzeitraum,
} from "./abo";

/** Zürcher Schulferien 2026/27 und 2027/28. */
const FERIEN: Ferienzeitraum[] = [
  { bezeichnung: "Herbstferien 2026", start: "2026-10-05", ende: "2026-10-16" },
  { bezeichnung: "Weihnachtsferien 2026", start: "2026-12-21", ende: "2027-01-01" },
  { bezeichnung: "Sportferien 2027", start: "2027-02-08", ende: "2027-02-19" },
  { bezeichnung: "Frühlingsferien 2027", start: "2027-04-19", ende: "2027-04-30" },
  { bezeichnung: "Sommerferien 2027", start: "2027-07-19", ende: "2027-08-20" },
  { bezeichnung: "Herbstferien 2027", start: "2027-10-04", ende: "2027-10-15" },
  { bezeichnung: "Weihnachtsferien 2027", start: "2027-12-20", ende: "2028-01-02" },
];

const DIENSTAG = 2;

describe("Ferienerkennung", () => {
  it("erkennt Tage innerhalb und ausserhalb", () => {
    expect(istFerientag("2026-10-06", FERIEN)).toBe(true);
    expect(istFerientag("2026-10-20", FERIEN)).toBe(false);
  });

  it("zählt beide Randtage mit", () => {
    expect(istFerientag("2026-10-05", FERIEN)).toBe(true);
    expect(istFerientag("2026-10-16", FERIEN)).toBe(true);
    expect(istFerientag("2026-10-04", FERIEN)).toBe(false);
    expect(istFerientag("2026-10-17", FERIEN)).toBe(false);
  });
});

describe("Periodenende", () => {
  it("rechnet Halbjahr und Jahr korrekt", () => {
    expect(periodenEnde("2026-10-01", 6)).toBe("2027-03-31");
    expect(periodenEnde("2026-10-01", 12)).toBe("2027-09-30");
  });

  it("rutscht am Monatsende nicht in den Folgemonat", () => {
    // 31. August + 6 Monate gäbe den 31. Februar – den gibt es nicht.
    expect(periodenEnde("2026-08-31", 6)).toBe("2027-02-27");
  });
});

describe("Unterrichtstermine einer Periode", () => {
  it("lässt Ferientermine aus und zählt sie separat", () => {
    const t = berechneAboTermine({
      start: "2026-10-01",
      ende: "2027-03-31",
      weekday: DIENSTAG,
      rhythmus: "woechentlich",
      ferien: FERIEN,
    });
    expect(t.anzahl).toBe(20);
    expect(t.ferientage).toHaveLength(6);
    // Kein Termin darf in den Ferien liegen.
    for (const tag of t.termine) expect(istFerientag(tag, FERIEN)).toBe(false);
  });

  it("legt jeden Termin auf den gewählten Wochentag", () => {
    const t = berechneAboTermine({
      start: "2026-10-01",
      ende: "2027-03-31",
      weekday: DIENSTAG,
      rhythmus: "woechentlich",
      ferien: FERIEN,
    });
    for (const tag of t.termine) {
      expect(new Date(`${tag}T00:00:00Z`).getUTCDay()).toBe(DIENSTAG);
    }
  });

  it("hält bei zweiwöchentlich den doppelten Abstand", () => {
    const t = berechneAboTermine({
      start: "2026-10-01",
      ende: "2027-03-31",
      weekday: DIENSTAG,
      rhythmus: "zweiwoechentlich",
      ferien: [],
    });
    for (let i = 1; i < t.termine.length; i++) {
      const abstand =
        (Date.parse(`${t.termine[i]}T00:00:00Z`) -
          Date.parse(`${t.termine[i - 1]}T00:00:00Z`)) /
        86400000;
      expect(abstand).toBe(14);
    }
  });

  it("kommt ohne Ferien klar", () => {
    const t = berechneAboTermine({
      start: "2026-10-01",
      ende: "2027-03-31",
      weekday: DIENSTAG,
      rhythmus: "woechentlich",
      ferien: [],
    });
    expect(t.ferientage).toHaveLength(0);
    expect(t.anzahl).toBe(26);
  });
});

describe("Abo-Angebot", () => {
  /** Daves Preise: Halbjahr 70, Jahr 65 pro Lektion. */
  const preise = { halbjahr: 70, jahr: 65 };

  it("trifft die erwarteten Lektionszahlen", () => {
    const faelle = [
      { variante: "halbjahr" as const, rhythmus: "woechentlich" as const, lektionen: 20 },
      { variante: "halbjahr" as const, rhythmus: "zweiwoechentlich" as const, lektionen: 10 },
      { variante: "jahr" as const, rhythmus: "woechentlich" as const, lektionen: 39 },
      { variante: "jahr" as const, rhythmus: "zweiwoechentlich" as const, lektionen: 20 },
    ];
    for (const f of faelle) {
      const a = baueAboAngebot({
        variante: f.variante,
        rhythmus: f.rhythmus,
        weekday: DIENSTAG,
        periodeStart: "2026-10-01",
        preisProLektion: preise[f.variante],
        ferien: FERIEN,
      });
      expect(a.lektionen).toBe(f.lektionen);
    }
  });

  it("rechnet den Monatsbetrag aus Gesamtpreis und Laufzeit", () => {
    const a = baueAboAngebot({
      variante: "halbjahr",
      rhythmus: "woechentlich",
      weekday: DIENSTAG,
      periodeStart: "2026-10-01",
      preisProLektion: 70,
      ferien: FERIEN,
    });
    expect(a.gesamtpreis).toBe(1400);
    expect(a.laufzeitMonate).toBe(6);
    expect(a.monatsbetrag).toBe(233.35);
  });

  it("macht das Jahresabo pro Monat günstiger als das Halbjahr", () => {
    // Gegenwert für die längere Bindung – sonst gäbe es keinen Grund, es zu
    // wählen, und die Planbarkeit wäre nichts wert.
    const halb = baueAboAngebot({
      variante: "halbjahr",
      rhythmus: "woechentlich",
      weekday: DIENSTAG,
      periodeStart: "2026-10-01",
      preisProLektion: 70,
      ferien: FERIEN,
    });
    const jahr = baueAboAngebot({
      variante: "jahr",
      rhythmus: "woechentlich",
      weekday: DIENSTAG,
      periodeStart: "2026-10-01",
      preisProLektion: 65,
      ferien: FERIEN,
    });
    expect(halb.monatsbetrag).toBe(233.35);
    expect(jahr.monatsbetrag).toBe(211.25);
    expect(jahr.monatsbetrag).toBeLessThan(halb.monatsbetrag);
  });

  it("weist die Ferientermine aus, statt sie zu verschweigen", () => {
    const a = baueAboAngebot({
      variante: "halbjahr",
      rhythmus: "woechentlich",
      weekday: DIENSTAG,
      periodeStart: "2026-10-01",
      preisProLektion: 70,
      ferien: FERIEN,
    });
    expect(a.ferientage.length).toBeGreaterThan(0);
    for (const f of a.ferientage) expect(f.grund).toBeTruthy();
  });

  it("hängt die Lektionszahl an der Jahreszeit – darum wird gerechnet", () => {
    // Ein Halbjahr über den Sommer enthält weniger Lektionen als eines über
    // den Winter. Genau deshalb darf keine Pauschalzahl versprochen werden.
    const winter = baueAboAngebot({
      variante: "halbjahr",
      rhythmus: "woechentlich",
      weekday: DIENSTAG,
      periodeStart: "2026-10-01",
      preisProLektion: 70,
      ferien: FERIEN,
    });
    const sommer = baueAboAngebot({
      variante: "halbjahr",
      rhythmus: "woechentlich",
      weekday: DIENSTAG,
      periodeStart: "2027-04-01",
      preisProLektion: 70,
      ferien: FERIEN,
    });
    expect(winter.lektionen).not.toBe(sommer.lektionen);
    // Und der Preis folgt der Lektionszahl, nicht umgekehrt.
    expect(winter.gesamtpreis).toBe(winter.lektionen * 70);
    expect(sommer.gesamtpreis).toBe(sommer.lektionen * 70);
  });
});

describe("Monatsraten", () => {
  it("ergibt in der Summe exakt den Gesamtpreis", () => {
    for (const [preis, monate] of [
      [1300, 6],
      [2340, 12],
      [650, 6],
      [1200, 12],
      [1, 6],
      [999.95, 12],
    ] as const) {
      const raten = baueMonatsraten(preis, monate, "2026-10-01");
      const summe = raten.reduce((s, r) => s + r.betrag, 0);
      expect(Math.round(summe * 100) / 100).toBe(preis);
    }
  });

  it("legt genau eine Rate pro Monat an", () => {
    const raten = baueMonatsraten(1300, 6, "2026-10-01");
    expect(raten).toHaveLength(6);
    expect(raten[0].faellig).toBe("2026-10-01");
    expect(raten[5].faellig).toBe("2027-03-01");
  });

  it("hält alle Raten bis auf die letzte gleich", () => {
    const raten = baueMonatsraten(1300, 6, "2026-10-01");
    const ohneLetzte = raten.slice(0, -1).map((r) => r.betrag);
    expect(new Set(ohneLetzte).size).toBe(1);
  });

  it("rutscht am Monatsende nicht in den Folgemonat", () => {
    const raten = baueMonatsraten(600, 6, "2026-01-31");
    expect(raten[1].faellig).toBe("2026-02-28");
  });
});

describe("Kündigung", () => {
  it("endet 30 Tage vor Periodenschluss", () => {
    expect(ABO_KUENDIGUNGSFRIST_TAGE).toBe(30);
    expect(kuendigungsfrist("2027-03-31")).toBe("2027-03-01");
  });

  it("erlaubt Kündigung vor, nicht nach der Frist", () => {
    expect(istKuendbar("2027-03-31", "2027-02-15")).toBe(true);
    expect(istKuendbar("2027-03-31", "2027-03-01")).toBe(true);
    expect(istKuendbar("2027-03-31", "2027-03-02")).toBe(false);
  });
});

describe("Laufzeiten", () => {
  it("ist beim Halbjahr 6 und beim Jahr 12 Monate", () => {
    expect(ABO_LAUFZEIT_MONATE.halbjahr).toBe(6);
    expect(ABO_LAUFZEIT_MONATE.jahr).toBe(12);
  });
});
