import { describe, expect, it } from "vitest";
import { findeEinpassung, type BestehenderTermin } from "./zuteilung";
import { navigationsLink } from "./geo";

// Reale Geografie rund um Neftenbach, damit die Zahlen nachvollziehbar sind.
const ZUHAUSE = { lat: 47.5305, lng: 8.6717 }; // Neftenbach
const PFUNGEN = { lat: 47.5158, lng: 8.6497 };
const WINTERTHUR = { lat: 47.4995, lng: 8.7241 };
const ANDELFINGEN = { lat: 47.5945, lng: 8.6789 };

const FENSTER = [
  { wochentag: 2, beginn: "16:30", ende: "20:30" },
  { wochentag: 3, beginn: "16:30", ende: "20:30" },
];

function schueler(pos: { lat: number; lng: number }, tage: number[]) {
  return {
    id: "neu",
    name: "Neu",
    lat: pos.lat,
    lng: pos.lng,
    rhythmus: "woechentlich" as const,
    lektionMinuten: 45,
    verfuegbarkeiten: tage.map((wochentag) => ({
      wochentag,
      fruehestens: "16:30",
      spaetestens: "20:30",
      praeferenz: 3,
    })),
  };
}

describe("findeEinpassung", () => {
  it("bevorzugt den Platz, der auf dem Weg liegt", () => {
    // Dienstag: Pfungen um 17:00, Winterthur um 19:15. Dazwischen ist Platz,
    // und ein Schüler zwischen den beiden Orten verlängert die Fahrt kaum.
    const bestehend: BestehenderTermin[] = [
      {
        schuelerId: "a",
        name: "Pfungen",
        ...PFUNGEN,
        wochentag: 2,
        beginn: "17:00",
        lektionMinuten: 45,
        paritaet: null,
      },
      {
        schuelerId: "b",
        name: "Winterthur",
        ...WINTERTHUR,
        wochentag: 2,
        beginn: "19:15",
        lektionMinuten: 45,
        paritaet: null,
      },
      // Mittwoch führt weit nach Norden, jeder Zusatzhalt kostet dort mehr.
      {
        schuelerId: "c",
        name: "Andelfingen",
        ...ANDELFINGEN,
        wochentag: 3,
        beginn: "17:00",
        lektionMinuten: 45,
        paritaet: null,
      },
    ];

    // Der Neue wohnt zwischen Pfungen und Winterthur.
    const zwischendrin = { lat: 47.5075, lng: 8.6875 };

    const vorschlaege = findeEinpassung({
      zuhause: ZUHAUSE,
      neuer: schueler(zwischendrin, [2, 3]),
      bestehend,
      fenster: FENSTER,
      pufferMinuten: 15,
    });

    expect(vorschlaege.length).toBeGreaterThan(0);

    const bester = vorschlaege[0];
    expect(bester.wochentag).toBe(2);
    expect(bester.aufDemWeg).toBe(true);
    // Zwischen den beiden bestehenden Terminen, also mit Nachbarn auf beiden Seiten.
    expect(bester.davor).toBe("Pfungen");
    expect(bester.danach).toBe("Winterthur");

    // Der Mittwoch, Umweg nach Andelfingen, muss teurer sein.
    const mittwoch = vorschlaege.find((v) => v.wochentag === 3);
    if (mittwoch) {
      expect(mittwoch.zusatzSekunden).toBeGreaterThan(bester.zusatzSekunden);
    }
  });

  it("ist nach Zusatzfahrzeit sortiert", () => {
    const bestehend: BestehenderTermin[] = [
      {
        schuelerId: "a",
        name: "Pfungen",
        ...PFUNGEN,
        wochentag: 2,
        beginn: "17:00",
        lektionMinuten: 45,
        paritaet: null,
      },
    ];

    const vorschlaege = findeEinpassung({
      zuhause: ZUHAUSE,
      neuer: schueler(WINTERTHUR, [2]),
      bestehend,
      fenster: FENSTER,
      pufferMinuten: 15,
      maxVorschlaege: 5,
    });

    for (let i = 1; i < vorschlaege.length; i++) {
      expect(vorschlaege[i].zusatzSekunden).toBeGreaterThanOrEqual(
        vorschlaege[i - 1].zusatzSekunden
      );
    }
  });

  it("schlägt nichts vor, wenn der Schüler an keinem freien Tag kann", () => {
    // Er kann nur am Montag, dafür gibt es kein Fenster.
    const vorschlaege = findeEinpassung({
      zuhause: ZUHAUSE,
      neuer: schueler(WINTERTHUR, [1]),
      bestehend: [],
      fenster: FENSTER,
      pufferMinuten: 15,
    });
    expect(vorschlaege).toEqual([]);
  });

  it("respektiert bestehende Termine samt Puffer", () => {
    // Ein Termin 17:00–17:45 plus 15 Min. Puffer blockiert 16:45 bis 18:00.
    const bestehend: BestehenderTermin[] = [
      {
        schuelerId: "a",
        name: "Pfungen",
        ...PFUNGEN,
        wochentag: 2,
        beginn: "17:00",
        lektionMinuten: 45,
        paritaet: null,
      },
    ];

    const vorschlaege = findeEinpassung({
      zuhause: ZUHAUSE,
      neuer: schueler(WINTERTHUR, [2]),
      bestehend,
      fenster: FENSTER,
      pufferMinuten: 15,
      maxVorschlaege: 50,
    });

    const kollidiert = vorschlaege.filter((v) => {
      const [h, m] = v.beginn.split(":").map(Number);
      const beginn = h * 60 + m;
      return beginn < 17 * 60 + 45 + 15 && beginn + 45 + 15 > 17 * 60;
    });
    expect(kollidiert).toEqual([]);
  });

  it("gibt nichts zurück, wenn die Adresse nicht geokodiert ist", () => {
    const vorschlaege = findeEinpassung({
      zuhause: ZUHAUSE,
      neuer: schueler({ lat: NaN, lng: NaN }, [2, 3]),
      bestehend: [],
      fenster: FENSTER,
      pufferMinuten: 15,
    });
    expect(vorschlaege).toEqual([]);
  });
});

describe("navigationsLink", () => {
  it("beginnt und endet zuhause und behält die Reihenfolge", () => {
    const link = navigationsLink(ZUHAUSE, [PFUNGEN, WINTERTHUR]);
    expect(link).not.toBeNull();

    const url = new URL(link!);
    expect(url.searchParams.get("origin")).toBe("47.5305,8.6717");
    expect(url.searchParams.get("destination")).toBe("47.5305,8.6717");
    expect(url.searchParams.get("travelmode")).toBe("driving");
    // Reihenfolge wie übergeben, Pfungen zuerst.
    expect(url.searchParams.get("waypoints")).toBe(
      "47.5158,8.6497|47.4995,8.7241"
    );
  });

  it("liefert ohne Stationen keinen Link", () => {
    expect(navigationsLink(ZUHAUSE, [])).toBeNull();
  });

  it("kappt bei neun Zwischenstopps, weil Google Maps nicht mehr annimmt", () => {
    const viele = Array.from({ length: 14 }, (_, i) => ({
      lat: 47.5 + i / 1000,
      lng: 8.7,
    }));
    const url = new URL(navigationsLink(ZUHAUSE, viele)!);
    expect(url.searchParams.get("waypoints")!.split("|")).toHaveLength(9);
  });
});
