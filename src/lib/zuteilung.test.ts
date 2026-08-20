import { describe, expect, it } from "vitest";
import {
  beschreibeZuteilung,
  moeglichePlaetze,
  teileZu,
  type Verfuegbarkeit,
  type ZuteilSchueler,
} from "./zuteilung";
import type { Tagesfenster } from "./routing";

const ZUHAUSE = { lat: 47.5266, lng: 8.6706 };

const FENSTER: Tagesfenster[] = [
  { wochentag: 1, beginn: "16:30", ende: "20:30" },
  { wochentag: 2, beginn: "16:30", ende: "20:30" },
  { wochentag: 3, beginn: "16:30", ende: "20:30" },
  { wochentag: 4, beginn: "16:30", ende: "20:30" },
  { wochentag: 5, beginn: "16:30", ende: "18:00" },
];

function schueler(
  over: Partial<ZuteilSchueler> & { id: string; verfuegbarkeiten: Verfuegbarkeit[] }
): ZuteilSchueler {
  return {
    name: over.id,
    lat: 47.52,
    lng: 8.67,
    rhythmus: "woechentlich",
    lektionMinuten: 45,
    ...over,
  };
}

const GANZ_DIENSTAG: Verfuegbarkeit = {
  wochentag: 2,
  fruehestens: "16:30",
  spaetestens: "20:30",
  praeferenz: 2,
};

describe("Mögliche Plätze", () => {
  it("schneidet Schülerfenster und Unterrichtsfenster", () => {
    const s = schueler({
      id: "a",
      verfuegbarkeiten: [
        { wochentag: 2, fruehestens: "15:00", spaetestens: "18:00", praeferenz: 2 },
      ],
    });
    const p = moeglichePlaetze(s, FENSTER);
    // Unterricht beginnt erst 16:30, der Schüler kann bis 18:00 →
    // letzter möglicher Beginn ist 17:15 (45 Min. Lektion).
    expect(p[0].beginn).toBe("16:30");
    expect(p[p.length - 1].beginn).toBe("17:15");
  });

  it("gibt nichts zurück, wenn die Zeiten nicht überlappen", () => {
    const s = schueler({
      id: "a",
      verfuegbarkeiten: [
        { wochentag: 2, fruehestens: "08:00", spaetestens: "12:00", praeferenz: 2 },
      ],
    });
    expect(moeglichePlaetze(s, FENSTER)).toHaveLength(0);
  });

  it("ignoriert Tage ohne Unterricht", () => {
    const s = schueler({
      id: "a",
      verfuegbarkeiten: [
        { wochentag: 6, fruehestens: "10:00", spaetestens: "18:00", praeferenz: 3 },
      ],
    });
    expect(moeglichePlaetze(s, FENSTER)).toHaveLength(0);
  });

  it("behält bei überlappenden Fenstern die höhere Präferenz", () => {
    const s = schueler({
      id: "a",
      verfuegbarkeiten: [
        { wochentag: 2, fruehestens: "16:30", spaetestens: "20:30", praeferenz: 1 },
        { wochentag: 2, fruehestens: "17:00", spaetestens: "18:00", praeferenz: 3 },
      ],
    });
    const p = moeglichePlaetze(s, FENSTER);
    const um1700 = p.find((x) => x.beginn === "17:00");
    expect(um1700?.praeferenz).toBe(3);
  });
});

describe("Zuteilung, harte Nebenbedingung", () => {
  it("gibt niemandem einen Termin, den er nicht kann", () => {
    // Das ist die wichtigste Eigenschaft überhaupt: lieber jemanden nicht
    // zuteilen als ihm einen Termin geben, an dem er nicht kann.
    const s: ZuteilSchueler[] = [
      schueler({
        id: "nur-mo-frueh",
        lat: 47.52,
        lng: 8.67,
        verfuegbarkeiten: [
          { wochentag: 1, fruehestens: "16:30", spaetestens: "17:15", praeferenz: 3 },
        ],
      }),
      schueler({
        id: "nur-di-spaet",
        lat: 47.5,
        lng: 8.72,
        verfuegbarkeiten: [
          { wochentag: 2, fruehestens: "19:00", spaetestens: "20:30", praeferenz: 3 },
        ],
      }),
    ];
    const r = teileZu({ zuhause: ZUHAUSE, schueler: s, fenster: FENSTER, pufferMinuten: 0 });

    for (const z of r.zuteilungen) {
      const person = s.find((x) => x.id === z.schuelerId)!;
      const passt = person.verfuegbarkeiten.some(
        (v) =>
          v.wochentag === z.wochentag &&
          z.beginn >= v.fruehestens &&
          z.beginn <= v.spaetestens
      );
      expect(passt).toBe(true);
    }
  });

  it("meldet Schüler ohne Verfügbarkeit, statt sie zu übergehen", () => {
    const r = teileZu({
      zuhause: ZUHAUSE,
      schueler: [schueler({ id: "stumm", verfuegbarkeiten: [] })],
      fenster: FENSTER,
      pufferMinuten: 0,
    });
    expect(r.zuteilungen).toHaveLength(0);
    expect(r.nichtZugeteilt).toHaveLength(1);
    expect(r.nichtZugeteilt[0].grund).toContain("Keine Verfügbarkeit");
  });

  it("meldet Schüler, deren Zeiten ausserhalb liegen", () => {
    const r = teileZu({
      zuhause: ZUHAUSE,
      schueler: [
        schueler({
          id: "morgens",
          verfuegbarkeiten: [
            { wochentag: 2, fruehestens: "08:00", spaetestens: "10:00", praeferenz: 3 },
          ],
        }),
      ],
      fenster: FENSTER,
      pufferMinuten: 0,
    });
    expect(r.nichtZugeteilt[0].grund).toContain("ausserhalb");
  });

  it("meldet Schüler ohne Koordinaten", () => {
    const r = teileZu({
      zuhause: ZUHAUSE,
      schueler: [
        schueler({ id: "ohne", lat: NaN, lng: NaN, verfuegbarkeiten: [GANZ_DIENSTAG] }),
      ],
      fenster: FENSTER,
      pufferMinuten: 0,
    });
    expect(r.nichtZugeteilt[0].grund).toContain("Koordinaten");
  });
});

describe("Zuteilung, Kollisionen", () => {
  it("legt keine zwei wöchentlichen Schüler auf dieselbe Zeit", () => {
    const s = Array.from({ length: 4 }, (_, i) =>
      schueler({
        id: `s${i}`,
        lat: 47.52 + i * 0.01,
        lng: 8.67,
        verfuegbarkeiten: [GANZ_DIENSTAG],
      })
    );
    const r = teileZu({ zuhause: ZUHAUSE, schueler: s, fenster: FENSTER, pufferMinuten: 0 });

    const belegt = new Set<string>();
    for (const z of r.zuteilungen) {
      const key = `${z.wochentag}-${z.beginn}`;
      expect(belegt.has(key)).toBe(false);
      belegt.add(key);
    }
  });

  it("lässt zwei zweiwöchentliche Schüler denselben Platz teilen", () => {
    // Der eigentliche Kapazitätsgewinn: verschiedene Wochenparität,
    // gleicher Slot.
    const s = [
      schueler({
        id: "a",
        lat: 47.52,
        lng: 8.67,
        rhythmus: "zweiwoechentlich",
        verfuegbarkeiten: [
          { wochentag: 2, fruehestens: "17:00", spaetestens: "17:45", praeferenz: 3 },
        ],
      }),
      schueler({
        id: "b",
        lat: 47.521,
        lng: 8.671,
        rhythmus: "zweiwoechentlich",
        verfuegbarkeiten: [
          { wochentag: 2, fruehestens: "17:00", spaetestens: "17:45", praeferenz: 3 },
        ],
      }),
    ];
    const r = teileZu({ zuhause: ZUHAUSE, schueler: s, fenster: FENSTER, pufferMinuten: 0 });

    expect(r.zuteilungen).toHaveLength(2);
    expect(r.zuteilungen[0].beginn).toBe(r.zuteilungen[1].beginn);
    expect(r.zuteilungen[0].paritaet).not.toBe(r.zuteilungen[1].paritaet);
  });

  it("hält den Puffer zwischen zwei Lektionen ein", () => {
    const s = Array.from({ length: 3 }, (_, i) =>
      schueler({
        id: `s${i}`,
        lat: 47.52 + i * 0.005,
        lng: 8.67,
        verfuegbarkeiten: [GANZ_DIENSTAG],
      })
    );
    const r = teileZu({ zuhause: ZUHAUSE, schueler: s, fenster: FENSTER, pufferMinuten: 15 });

    const proTag = r.zuteilungen
      .filter((z) => z.wochentag === 2)
      .sort((a, b) => a.beginn.localeCompare(b.beginn));

    for (let i = 1; i < proTag.length; i++) {
      const [h1, m1] = proTag[i - 1].beginn.split(":").map(Number);
      const [h2, m2] = proTag[i].beginn.split(":").map(Number);
      const abstand = h2 * 60 + m2 - (h1 * 60 + m1);
      expect(abstand).toBeGreaterThanOrEqual(45 + 15);
    }
  });
});

describe("Zuteilung, Reihenfolge nach Knappheit", () => {
  it("bedient zuerst, wer die wenigsten Möglichkeiten hat", () => {
    // Der eingeschränkte Schüler muss seinen einzigen Platz bekommen. Käme
    // der flexible zuerst dran und besetzte ihn, fiele der andere heraus.
    const eng = schueler({
      id: "eng",
      lat: 47.52,
      lng: 8.67,
      verfuegbarkeiten: [
        { wochentag: 2, fruehestens: "17:00", spaetestens: "17:45", praeferenz: 3 },
      ],
    });
    const flexibel = schueler({
      id: "flexibel",
      lat: 47.53,
      lng: 8.68,
      verfuegbarkeiten: [
        { wochentag: 1, fruehestens: "16:30", spaetestens: "20:30", praeferenz: 2 },
        { wochentag: 2, fruehestens: "16:30", spaetestens: "20:30", praeferenz: 2 },
        { wochentag: 3, fruehestens: "16:30", spaetestens: "20:30", praeferenz: 2 },
      ],
    });

    // Bewusst in der ungünstigen Reihenfolge übergeben.
    const r = teileZu({
      zuhause: ZUHAUSE,
      schueler: [flexibel, eng],
      fenster: FENSTER,
      pufferMinuten: 0,
    });

    expect(r.nichtZugeteilt).toHaveLength(0);
    const engZ = r.zuteilungen.find((z) => z.schuelerId === "eng")!;
    expect(engZ.wochentag).toBe(2);
    expect(engZ.beginn).toBe("17:00");
  });
});

describe("Zuteilung, bestehende Plätze und Wünsche", () => {
  it("behält einen bestehenden Platz bei, wenn möglich", () => {
    // Umzüge im Stundenplan sind für Schüler lästig. Ohne diesen Bonus
    // würde der Planer alles umwerfen, um zwei Minuten zu sparen.
    const s = schueler({
      id: "a",
      lat: 47.52,
      lng: 8.67,
      verfuegbarkeiten: [GANZ_DIENSTAG],
      bisher: { wochentag: 2, zeit: "19:00" },
    });
    const r = teileZu({ zuhause: ZUHAUSE, schueler: [s], fenster: FENSTER, pufferMinuten: 0 });
    expect(r.zuteilungen[0].beginn).toBe("19:00");
    expect(r.zuteilungen[0].unveraendert).toBe(true);
    expect(r.unveraendert).toBe(1);
  });

  it("zählt erfüllte Wunschtermine", () => {
    const s = schueler({
      id: "a",
      lat: 47.52,
      lng: 8.67,
      verfuegbarkeiten: [
        { wochentag: 2, fruehestens: "16:30", spaetestens: "20:30", praeferenz: 3 },
      ],
    });
    const r = teileZu({ zuhause: ZUHAUSE, schueler: [s], fenster: FENSTER, pufferMinuten: 0 });
    expect(r.wunschErfuellt).toBe(1);
  });
});

describe("Zuteilung, Gesamtergebnis", () => {
  it("teilt jeden Schüler höchstens einmal zu", () => {
    const s = Array.from({ length: 8 }, (_, i) =>
      schueler({
        id: `s${i}`,
        lat: 47.5 + i * 0.01,
        lng: 8.65 + i * 0.01,
        verfuegbarkeiten: [
          { wochentag: (i % 4) + 1, fruehestens: "16:30", spaetestens: "20:30", praeferenz: 2 },
        ],
      })
    );
    const r = teileZu({ zuhause: ZUHAUSE, schueler: s, fenster: FENSTER, pufferMinuten: 15 });
    const ids = r.zuteilungen.map((z) => z.schuelerId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("weist eine Fahrzeit aus", () => {
    const s = Array.from({ length: 3 }, (_, i) =>
      schueler({
        id: `s${i}`,
        lat: 47.5 + i * 0.02,
        lng: 8.65 + i * 0.02,
        verfuegbarkeiten: [GANZ_DIENSTAG],
      })
    );
    const r = teileZu({ zuhause: ZUHAUSE, schueler: s, fenster: FENSTER, pufferMinuten: 0 });
    expect(r.fahrzeitProWoche).toBeGreaterThan(0);
  });

  it("kommt mit einer leeren Liste klar", () => {
    const r = teileZu({ zuhause: ZUHAUSE, schueler: [], fenster: FENSTER, pufferMinuten: 0 });
    expect(r.zuteilungen).toHaveLength(0);
    expect(r.fahrzeitProWoche).toBe(0);
  });
});

describe("Beschreibung", () => {
  it("formuliert wöchentlich und zweiwöchentlich unterschiedlich", () => {
    expect(
      beschreibeZuteilung({
        schuelerId: "a",
        name: "A",
        wochentag: 2,
        beginn: "17:15",
        paritaet: null,
        praeferenz: 3,
        anfahrtSekunden: 0,
        unveraendert: false,
      })
    ).toBe("Jeden Dienstag um 17:15");

    expect(
      beschreibeZuteilung({
        schuelerId: "b",
        name: "B",
        wochentag: 4,
        beginn: "18:00",
        paritaet: 1,
        praeferenz: 2,
        anfahrtSekunden: 0,
        unveraendert: false,
      })
    ).toBe("Jeden zweiten Donnerstag um 18:00 (ungerade Wochen)");
  });
});

/**
 * „Zur Not" verliert gegen „am besten", wenn die Fahrzeit gleich ist.
 *
 * Genau das versprechen Formular und Mail: Der Stern markiert die
 * Wunschzeit, und wenn die Route es zulässt, bekommt man sie. Ohne diese
 * Tests wäre das Versprechen nur eine Behauptung — die Präferenz fliesst
 * als Bonus in die Kostenrechnung ein, und ein stiller Vorzeichenfehler
 * dort würde niemandem auffallen: Es gäbe ja weiterhin gültige Pläne.
 */
describe("Zuteilung, Präferenzen", () => {
  it("wählt das Wunschfenster statt des Notfensters", () => {
    // Ein Schüler, ein Tag, zwei Fenster: früh nur zur Not, spät am
    // liebsten. Die Fahrzeit ist für beide identisch, also muss allein die
    // Präferenz entscheiden.
    const s = schueler({
      id: "a",
      verfuegbarkeiten: [
        { wochentag: 2, fruehestens: "16:30", spaetestens: "18:00", praeferenz: 1 },
        { wochentag: 2, fruehestens: "18:30", spaetestens: "20:30", praeferenz: 3 },
      ],
    });
    const r = teileZu({
      zuhause: ZUHAUSE,
      schueler: [s],
      fenster: FENSTER,
      pufferMinuten: 0,
    });

    expect(r.zuteilungen).toHaveLength(1);
    const beginn = r.zuteilungen[0].beginn;
    expect(beginn >= "18:30").toBe(true);
    expect(r.zuteilungen[0].praeferenz).toBe(3);
    expect(r.wunschErfuellt).toBe(1);
  });

  it("ordnet 'gut' über 'zur Not' ein, auch ohne Stern", () => {
    const s = schueler({
      id: "b",
      verfuegbarkeiten: [
        { wochentag: 3, fruehestens: "16:30", spaetestens: "18:00", praeferenz: 1 },
        { wochentag: 3, fruehestens: "18:30", spaetestens: "20:30", praeferenz: 2 },
      ],
    });
    const r = teileZu({
      zuhause: ZUHAUSE,
      schueler: [s],
      fenster: FENSTER,
      pufferMinuten: 0,
    });

    expect(r.zuteilungen[0].praeferenz).toBe(2);
  });

  it("opfert den Wunsch, wenn er sonst jemanden verdrängt", () => {
    // Zwei Schüler wollen exakt dasselbe enge Fenster, einer kann sonst
    // nichts. Der Unflexible muss den Platz bekommen, der andere weicht in
    // sein Notfenster aus: Kapazität geht vor Wunsch.
    const unflexibel = schueler({
      id: "eng",
      verfuegbarkeiten: [
        { wochentag: 2, fruehestens: "18:00", spaetestens: "18:45", praeferenz: 3 },
      ],
    });
    const flexibel = schueler({
      id: "breit",
      verfuegbarkeiten: [
        { wochentag: 2, fruehestens: "18:00", spaetestens: "18:45", praeferenz: 3 },
        { wochentag: 4, fruehestens: "16:30", spaetestens: "20:30", praeferenz: 1 },
      ],
    });
    const r = teileZu({
      zuhause: ZUHAUSE,
      schueler: [unflexibel, flexibel],
      fenster: FENSTER,
      pufferMinuten: 15,
    });

    expect(r.nichtZugeteilt).toHaveLength(0);
    const eng = r.zuteilungen.find((z) => z.schuelerId === "eng")!;
    expect(eng.wochentag).toBe(2);
    expect(eng.beginn).toBe("18:00");
  });
});

/**
 * Fremdtermine sind unverrückbar und blockieren.
 *
 * Externe Schüler laufen über eine andere Plattform: Ihr Termin ist dort
 * vergeben, David kann ihn nicht verschieben. Für die Zuteilung sind sie
 * keine Kandidaten — ihre Zeit ist aber weg, und ihr Wohnort liegt auf der
 * Route.
 *
 * Ohne `vorbelegt` würde die Zuteilung jemanden auf einen Dienstag um 17:00
 * legen, an dem David längst woanders sitzt. Im Kalender stünden dann zwei
 * Termine übereinander, und auffallen würde es frühestens am Dienstag.
 */
describe("Zuteilung, fremde Termine", () => {
  const extern = {
    schuelerId: "extern-1",
    name: "Matchspace-Schüler",
    lat: 47.52,
    lng: 8.67,
    wochentag: 2,
    beginn: "17:00",
    lektionMinuten: 45,
    paritaet: null,
  };

  it("legt niemanden auf eine fremd belegte Zeit", () => {
    const s = schueler({
      id: "a",
      verfuegbarkeiten: [
        { wochentag: 2, fruehestens: "17:00", spaetestens: "20:30", praeferenz: 2 },
      ],
    });
    const r = teileZu({
      zuhause: ZUHAUSE,
      schueler: [s],
      fenster: FENSTER,
      pufferMinuten: 15,
      vorbelegt: [extern],
    });

    expect(r.zuteilungen).toHaveLength(1);
    // Erst nach der fremden Lektion plus Puffer.
    expect(r.zuteilungen[0].beginn >= "18:00").toBe(true);
  });

  it("teilt den fremden Termin nicht selbst zu", () => {
    const s = schueler({ id: "a", verfuegbarkeiten: [GANZ_DIENSTAG] });
    const r = teileZu({
      zuhause: ZUHAUSE,
      schueler: [s],
      fenster: FENSTER,
      pufferMinuten: 15,
      vorbelegt: [extern],
    });

    // Der Externe darf nirgends als Zuteilung auftauchen: Er hat hier
    // keinen Fixplatz, den man setzen könnte.
    expect(r.zuteilungen.map((z) => z.schuelerId)).not.toContain("extern-1");
    expect(r.zuteilungen).toHaveLength(1);
  });

  it("rechnet die Fahrt zum fremden Termin mit", () => {
    // Er liegt auf der Route, also gehört seine Anfahrt in die Fahrzeit.
    // Sonst sähe ein Abend mit einem weit entfernten externen Schüler
    // künstlich günstig aus.
    const s = schueler({ id: "a", verfuegbarkeiten: [GANZ_DIENSTAG] });
    const basis = teileZu({
      zuhause: ZUHAUSE,
      schueler: [s],
      fenster: FENSTER,
      pufferMinuten: 15,
    });
    const mitFremd = teileZu({
      zuhause: ZUHAUSE,
      schueler: [s],
      fenster: FENSTER,
      pufferMinuten: 15,
      vorbelegt: [{ ...extern, lat: 47.62, lng: 8.85 }],
    });

    expect(mitFremd.fahrzeitProWoche).toBeGreaterThan(basis.fahrzeitProWoche);
  });

  it("kommt ohne fremde Termine unverändert klar", () => {
    const s = schueler({ id: "a", verfuegbarkeiten: [GANZ_DIENSTAG] });
    const ohne = teileZu({
      zuhause: ZUHAUSE,
      schueler: [s],
      fenster: FENSTER,
      pufferMinuten: 15,
    });
    const leer = teileZu({
      zuhause: ZUHAUSE,
      schueler: [s],
      fenster: FENSTER,
      pufferMinuten: 15,
      vorbelegt: [],
    });
    expect(leer.zuteilungen[0].beginn).toBe(ohne.zuteilungen[0].beginn);
  });
});
