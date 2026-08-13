import { describe, expect, it } from "vitest";
import { planeRouten, type PlanSchueler } from "./routing";

/**
 * Der Fall, der in der Praxis aufgefallen ist.
 *
 * Ein Schüler gibt an: „Dienstag ab 18:00" und „Freitag bis 18:00". Beides
 * zusammen zu einer Grenze zu verrechnen ergibt 18:00 bis 18:00, ein Fenster
 * von null Minuten. Der Schüler verschwand daraufhin aus dem Plan mit der
 * Begründung, er sei an keinem Unterrichtstag verfügbar, obwohl er dienstags
 * den ganzen Abend Zeit hat.
 *
 * Der Fehler war doppelt unangenehm: er trat nur bei Schülern mit
 * unterschiedlichen Zeiten je Tag auf, und er meldete einen Grund, der nicht
 * stimmte.
 */

const ZUHAUSE = { lat: 47.5305, lng: 8.6717 }; // Neftenbach

const FENSTER = [
  { wochentag: 2, beginn: "16:15", ende: "20:30" }, // Dienstag
  { wochentag: 5, beginn: "16:15", ende: "18:00" }, // Freitag
];

function schueler(teil: Partial<PlanSchueler>): PlanSchueler {
  return {
    id: "s1",
    name: "Testfall",
    lat: 47.5158,
    lng: 8.6497, // Pfungen
    rhythmus: "woechentlich",
    lektionMinuten: 45,
    ...teil,
  };
}

describe("Zeiten je Wochentag", () => {
  it("plant einen Schüler mit unterschiedlichen Zeiten je Tag ein", () => {
    const plan = planeRouten({
      zuhause: ZUHAUSE,
      schueler: [
        schueler({
          fenster: [
            { wochentag: 2, fruehestens: "18:00", spaetestens: "20:30" },
            { wochentag: 5, fruehestens: "16:15", spaetestens: "18:00" },
          ],
        }),
      ],
      fenster: FENSTER,
      pufferMinuten: 15,
    });

    expect(plan.nichtEingeplant).toEqual([]);
    expect(plan.positionen).toBe(1);
  });

  it("hält die Zeitgrenze des jeweiligen Tages ein", () => {
    const plan = planeRouten({
      zuhause: ZUHAUSE,
      schueler: [
        schueler({
          fenster: [
            { wochentag: 2, fruehestens: "18:00", spaetestens: "20:30" },
          ],
        }),
      ],
      fenster: FENSTER,
      pufferMinuten: 15,
    });

    const tag = plan.tage.find((t) => t.positionen.length > 0);
    expect(tag?.wochentag).toBe(2);
    const beginn = tag!.positionen[0].beginn;
    expect(beginn >= "18:00").toBe(true);
  });

  it("meldet nur dann „an keinem Tag verfügbar“, wenn es stimmt", () => {
    // Mittwoch ist kein Unterrichtstag, hier ist die Meldung berechtigt.
    const plan = planeRouten({
      zuhause: ZUHAUSE,
      schueler: [
        schueler({
          fenster: [
            { wochentag: 3, fruehestens: "16:30", spaetestens: "19:00" },
          ],
        }),
      ],
      fenster: FENSTER,
      pufferMinuten: 15,
    });

    expect(plan.nichtEingeplant).toHaveLength(1);
    expect(plan.nichtEingeplant[0].grund).toContain("keinem Unterrichtstag");
  });

  it("versteht mehrere Fenster am selben Tag", () => {
    // Etwa: früher Nachmittag oder später Abend, dazwischen nicht.
    const plan = planeRouten({
      zuhause: ZUHAUSE,
      schueler: [
        schueler({
          fenster: [
            { wochentag: 2, fruehestens: "16:15", spaetestens: "17:15" },
            { wochentag: 2, fruehestens: "19:30", spaetestens: "20:30" },
          ],
        }),
      ],
      fenster: FENSTER,
      pufferMinuten: 15,
    });

    expect(plan.nichtEingeplant).toEqual([]);
    const tag = plan.tage.find((t) => t.positionen.length > 0)!;
    const beginn = tag.positionen[0].beginn;
    // In einem der beiden Fenster, nicht dazwischen.
    expect(beginn <= "16:30" || beginn >= "19:30").toBe(true);
  });

  it("kommt weiterhin ohne Angaben aus", () => {
    const plan = planeRouten({
      zuhause: ZUHAUSE,
      schueler: [schueler({})],
      fenster: FENSTER,
      pufferMinuten: 15,
    });
    expect(plan.nichtEingeplant).toEqual([]);
  });
});
