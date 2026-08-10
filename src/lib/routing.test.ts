import { describe, expect, it } from "vitest";
import {
  empfohleneVariante,
  gruppiereNachRichtung,
  MAX_PAAR_DISTANZ_M,
  ordneRoute,
  paareZweiwoechentliche,
  planeRouten,
  vergleicheMitUnsortiert,
  vergleicheTagesanzahl,
  type PlanEingabe,
  type PlanSchueler,
  type Tagesfenster,
} from "./routing";
import { haversineMeter, schaetzeFahrzeit } from "./geo";

// Neftenbach – Daves Ausgangspunkt.
const ZUHAUSE = { lat: 47.5266, lng: 8.6706 };

const ORTE: Array<[string, number, number]> = [
  ["Neftenbach", 47.5266, 8.6706],
  ["Pfungen", 47.5109, 8.6446],
  ["Wülflingen", 47.5065, 8.6836],
  ["Winterthur Zentrum", 47.4999, 8.7241],
  ["Töss", 47.4867, 8.7106],
  ["Seen", 47.4869, 8.7532],
  ["Oberwinterthur", 47.5152, 8.757],
  ["Hettlingen", 47.5471, 8.7053],
  ["Henggart", 47.5665, 8.6902],
  ["Andelfingen", 47.5952, 8.6797],
  ["Embrach", 47.5074, 8.5928],
  ["Bülach", 47.5215, 8.5397],
  ["Elgg", 47.4922, 8.863],
  ["Wiesendangen", 47.5254, 8.7889],
  ["Rickenbach ZH", 47.5443, 8.7965],
  ["Dättlikon", 47.5218, 8.6395],
];

function schueler(
  anzahl = ORTE.length,
  jederDritteZweiwoechentlich = true
): PlanSchueler[] {
  return ORTE.slice(0, anzahl).map(([name, lat, lng], i) => ({
    id: `s${i}`,
    name,
    lat,
    lng,
    rhythmus:
      jederDritteZweiwoechentlich && i % 3 === 2
        ? ("zweiwoechentlich" as const)
        : ("woechentlich" as const),
    lektionMinuten: 45,
  }));
}

const FENSTER: Tagesfenster[] = [
  { wochentag: 1, beginn: "16:30", ende: "20:30" },
  { wochentag: 2, beginn: "16:30", ende: "20:30" },
  { wochentag: 3, beginn: "16:30", ende: "20:30" },
  { wochentag: 4, beginn: "16:30", ende: "20:30" },
  { wochentag: 5, beginn: "16:30", ende: "18:00" },
];

function eingabe(over: Partial<PlanEingabe> = {}): PlanEingabe {
  return {
    zuhause: ZUHAUSE,
    schueler: schueler(),
    fenster: FENSTER,
    pufferMinuten: 0,
    ...over,
  };
}

describe("Gruppierung nach Fahrtrichtung", () => {
  it("legt Ziele in derselben Himmelsrichtung zusammen", () => {
    // Elgg, Wiesendangen und Rickenbach liegen alle östlich von Neftenbach.
    // Man fährt ohnehin aneinander vorbei – sie gehören auf denselben Abend.
    const gruppen = gruppiereNachRichtung(ZUHAUSE, schueler(), 4);
    const gruppeMitElgg = gruppen.find((g) =>
      g.some((s) => s.name === "Elgg")
    );
    expect(gruppeMitElgg).toBeDefined();
    const namen = gruppeMitElgg!.map((s) => s.name);
    expect(
      namen.includes("Wiesendangen") || namen.includes("Rickenbach ZH")
    ).toBe(true);
  });

  it("verteilt gleichmässig statt einen Tag leer zu lassen", () => {
    // 16 Ziele auf 5 Tage: 4-3-3-3-3, nicht 4-4-4-4-0.
    const gruppen = gruppiereNachRichtung(ZUHAUSE, schueler(), 5);
    expect(gruppen).toHaveLength(5);
    for (const g of gruppen) expect(g.length).toBeGreaterThan(0);
    const groessen = gruppen.map((g) => g.length).sort();
    expect(groessen[groessen.length - 1] - groessen[0]).toBeLessThanOrEqual(1);
  });

  it("liefert bei weniger Zielen als Gruppen je eine Gruppe pro Ziel", () => {
    const gruppen = gruppiereNachRichtung(ZUHAUSE, schueler(3), 5);
    expect(gruppen).toHaveLength(3);
  });

  it("ist deterministisch – zweimal gerechnet, zweimal dasselbe", () => {
    const a = gruppiereNachRichtung(ZUHAUSE, schueler(), 4);
    const b = gruppiereNachRichtung(ZUHAUSE, schueler(), 4);
    expect(a.map((g) => g.map((s) => s.id))).toEqual(
      b.map((g) => g.map((s) => s.id))
    );
  });
});

describe("Paarung zweiwöchentlicher Schüler", () => {
  const nah: PlanSchueler[] = [
    {
      id: "a",
      name: "A",
      lat: 47.5266,
      lng: 8.6706,
      rhythmus: "zweiwoechentlich",
      lektionMinuten: 45,
    },
    {
      id: "b",
      name: "B",
      lat: 47.528,
      lng: 8.672,
      rhythmus: "zweiwoechentlich",
      lektionMinuten: 45,
    },
  ];

  it("legt nahe Nachbarn auf eine gemeinsame Position", () => {
    expect(haversineMeter(nah[0], nah[1])).toBeLessThan(MAX_PAAR_DISTANZ_M);
    const p = paareZweiwoechentliche(nah);
    expect(p).toHaveLength(1);
    expect(p[0].gerade?.id).toBe("a");
    expect(p[0].ungerade?.id).toBe("b");
  });

  it("paart niemanden über die Distanzgrenze hinweg", () => {
    // Der Plan rechnet eine geteilte Position mit dem Mittelpunkt. Bei weit
    // auseinander wohnenden Schülern läge der dort, wo niemand wohnt.
    const weit: PlanSchueler[] = [
      { ...nah[0] },
      { ...nah[1], lat: 47.4922, lng: 8.863 }, // Elgg, ~15 km weg
    ];
    expect(haversineMeter(weit[0], weit[1])).toBeGreaterThan(MAX_PAAR_DISTANZ_M);
    const p = paareZweiwoechentliche(weit);
    expect(p).toHaveLength(2);
    expect(p.every((x) => x.ungerade === null)).toBe(true);
  });

  it("gibt wöchentlichen Schülern beide Wochen", () => {
    const w: PlanSchueler[] = [
      { ...nah[0], rhythmus: "woechentlich" },
    ];
    const p = paareZweiwoechentliche(w);
    expect(p[0].gerade?.id).toBe("a");
    expect(p[0].ungerade?.id).toBe("a");
  });

  it("lässt bei ungerader Anzahl einen allein", () => {
    const drei = [...nah, { ...nah[0], id: "c", name: "C", lat: 47.5275 }];
    const p = paareZweiwoechentliche(drei);
    const alleine = p.filter((x) => x.ungerade === null);
    expect(alleine).toHaveLength(1);
  });
});

describe("Routenreihenfolge", () => {
  it("findet bei einer Kette die durchgehende Reihenfolge", () => {
    // Vier Punkte in einer Linie nach Osten – die günstigste Route ist,
    // sie der Reihe nach abzufahren, nicht hin und her zu springen.
    const orte = [
      { lat: 47.5266, lng: 8.72 },
      { lat: 47.5266, lng: 8.68 },
      { lat: 47.5266, lng: 8.76 },
      { lat: 47.5266, lng: 8.7 },
    ];
    const r = ordneRoute(ZUHAUSE, orte, schaetzeFahrzeit);
    const lngs = r.map((i) => orte[i].lng);
    expect(lngs).toEqual([...lngs].sort((a, b) => a - b));
  });

  it("kommt mit null oder einem Ziel klar", () => {
    expect(ordneRoute(ZUHAUSE, [], schaetzeFahrzeit)).toEqual([]);
    expect(ordneRoute(ZUHAUSE, [{ lat: 47.5, lng: 8.7 }], schaetzeFahrzeit)).toEqual([
      0,
    ]);
  });

  it("gibt jedes Ziel genau einmal zurück", () => {
    const orte = ORTE.map(([, lat, lng]) => ({ lat, lng }));
    const r = ordneRoute(ZUHAUSE, orte, schaetzeFahrzeit);
    expect(new Set(r).size).toBe(orte.length);
  });
});

describe("Wochenplan", () => {
  const plan = planeRouten(eingabe());

  it("bringt alle Schüler unter", () => {
    expect(plan.nichtEingeplant).toHaveLength(0);
  });

  it("überschreitet nie das Unterrichtsfenster", () => {
    for (const tag of plan.tage) {
      const f = FENSTER.find((x) => x.wochentag === tag.wochentag)!;
      for (const p of tag.positionen) {
        expect(p.beginn >= f.beginn).toBe(true);
        expect(p.ende <= f.ende).toBe(true);
      }
    }
  });

  it("legt keine zwei Lektionen übereinander", () => {
    for (const tag of plan.tage) {
      for (let i = 1; i < tag.positionen.length; i++) {
        expect(tag.positionen[i].beginn >= tag.positionen[i - 1].ende).toBe(true);
      }
    }
  });

  it("plant jeden Schüler genau einmal ein", () => {
    const gesehen = new Set<string>();
    for (const tag of plan.tage) {
      for (const p of tag.positionen) {
        for (const s of [p.geradeWoche, p.ungeradeWoche]) {
          if (!s) continue;
          if (p.geradeWoche?.id === p.ungeradeWoche?.id && gesehen.has(s.id)) {
            continue; // wöchentlich steht in beiden Wochen – zählt einmal
          }
          expect(gesehen.has(s.id)).toBe(false);
          gesehen.add(s.id);
        }
      }
    }
    expect(gesehen.size).toBe(ORTE.length);
  });

  it("zählt zweiwöchentliche Schüler als halbe Lektion pro Woche", () => {
    const woe = schueler().filter((s) => s.rhythmus === "woechentlich").length;
    const zwei = schueler().filter(
      (s) => s.rhythmus === "zweiwoechentlich"
    ).length;
    expect(plan.lektionenProWoche).toBe(woe + zwei / 2);
  });

  it("meldet Schüler ohne Koordinaten, statt sie stillschweigend wegzulassen", () => {
    const ohne = planeRouten(
      eingabe({
        schueler: [
          ...schueler(3),
          {
            id: "x",
            name: "Ohne Adresse",
            lat: NaN,
            lng: NaN,
            rhythmus: "woechentlich",
            lektionMinuten: 45,
          },
        ],
      })
    );
    expect(ohne.nichtEingeplant).toHaveLength(1);
    expect(ohne.nichtEingeplant[0].grund).toContain("Koordinaten");
  });

  it("respektiert Tageseinschränkungen der Schüler", () => {
    const nurMontag = schueler(6).map((s, i) =>
      i === 0 ? { ...s, moeglicheTage: [1] } : s
    );
    const p = planeRouten(eingabe({ schueler: nurMontag }));
    const tagVon = p.tage.find((t) =>
      t.positionen.some(
        (pos) => pos.geradeWoche?.id === "s0" || pos.ungeradeWoche?.id === "s0"
      )
    );
    if (tagVon) expect(tagVon.wochentag).toBe(1);
  });

  it("meldet, wenn jemand an keinem Unterrichtstag kann", () => {
    const p = planeRouten(
      eingabe({
        schueler: [{ ...schueler(1)[0], moeglicheTage: [6] }], // Samstag
      })
    );
    expect(p.nichtEingeplant).toHaveLength(1);
    expect(p.nichtEingeplant[0].grund).toContain("keinem Unterrichtstag");
  });

  it("meldet alle Schüler, wenn gar keine Zeiten hinterlegt sind", () => {
    const p = planeRouten(eingabe({ fenster: [] }));
    expect(p.nichtEingeplant).toHaveLength(ORTE.length);
    expect(p.tage).toHaveLength(0);
  });

  it("warnt, wenn ein Tag mehr Fahrt als Unterricht kostet", () => {
    // Ein einzelner weit entfernter Schüler an einem eigenen Tag.
    const p = planeRouten(
      eingabe({
        schueler: [
          {
            id: "fern",
            name: "Weit weg",
            lat: 47.2,
            lng: 9.2,
            rhythmus: "woechentlich",
            lektionMinuten: 45,
          },
        ],
        fenster: [{ wochentag: 1, beginn: "16:30", ende: "20:30" }],
      })
    );
    const warnungen = p.tage.flatMap((t) => t.warnungen);
    expect(warnungen.join(" ")).toContain("Fahrzeit");
  });
});

describe("Vergleich mit ungeplanter Verteilung", () => {
  it("weist eine Ersparnis aus", () => {
    const e = eingabe();
    const v = vergleicheMitUnsortiert(planeRouten(e), e);
    expect(v.ersparnisProWoche).toBeGreaterThan(0);
    expect(v.ersparnisStundenProJahr).toBeGreaterThan(0);
  });

  it("bleibt bei leerem Plan bei null", () => {
    const e = eingabe({ schueler: [] });
    const v = vergleicheMitUnsortiert(planeRouten(e), e);
    expect(v.ersparnisProWoche).toBe(0);
  });
});

describe("Wie viele Unterrichtstage lohnen sich", () => {
  const varianten = vergleicheTagesanzahl(eingabe());

  it("rechnet jede Variante von zwei Tagen an durch", () => {
    expect(varianten.length).toBeGreaterThanOrEqual(3);
  });

  it("zeigt, dass mehr Tage mehr Fahrzeit kosten", () => {
    // Der Kern der unternehmerischen Frage: jeder zusätzliche Unterrichtstag
    // bringt einen eigenen Hin- und Rückweg mit. Vier volle Abende sind
    // günstiger als fünf halbleere – bei identischer Lektionszahl.
    const vier = varianten.find((v) => v.tage === 4);
    const fuenf = varianten.find((v) => v.tage === 5);
    expect(vier).toBeDefined();
    expect(fuenf).toBeDefined();
    expect(vier!.lektionenProWoche).toBe(fuenf!.lektionenProWoche);
    expect(vier!.fahrzeitProWoche).toBeLessThan(fuenf!.fahrzeitProWoche);
  });

  it("empfiehlt nur Varianten, in denen alle Platz haben", () => {
    const e = empfohleneVariante(varianten);
    expect(e).not.toBeNull();
    expect(e!.nichtEingeplant).toBe(0);
  });

  it("empfiehlt die Variante mit der geringsten Fahrzeit", () => {
    const e = empfohleneVariante(varianten)!;
    const brauchbar = varianten.filter((v) => v.nichtEingeplant === 0);
    for (const v of brauchbar) {
      expect(e.fahrzeitProWoche).toBeLessThanOrEqual(v.fahrzeitProWoche);
    }
  });

  it("gibt null zurück, wenn keine Variante alle unterbringt", () => {
    const zuViele = vergleicheTagesanzahl(
      eingabe({ fenster: [{ wochentag: 1, beginn: "16:30", ende: "17:30" }] }),
      1
    );
    expect(empfohleneVariante(zuViele)).toBeNull();
  });
});
