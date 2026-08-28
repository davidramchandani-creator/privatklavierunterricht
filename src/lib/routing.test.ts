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

// Neftenbach, Daves Ausgangspunkt.
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
    // Man fährt ohnehin aneinander vorbei, sie gehören auf denselben Abend.
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

  it("ist deterministisch, zweimal gerechnet, zweimal dasselbe", () => {
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
    // Jeder belegt eine eigene Position, dort aber nur **eine** der beiden
    // Wochen — die andere Hälfte steht leer, das ist der Preis fürs
    // Nichtpaaren.
    expect(p.every((x) => (x.gerade === null) !== (x.ungerade === null))).toBe(
      true
    );
  });

  it("paart niemanden, der nie am selben Tag kann", () => {
    // Ein Paar teilt sich **einen** Termin — es braucht also einen Tag, an
    // dem beide können. Nach Nähe allein zu paaren war fatal: Das Paar
    // hatte danach keinen einzigen möglichen Tag, fiel durch jede Prüfung,
    // und **beide** standen unter „nicht eingeplant". Einzeln hätte jeder
    // von beiden einen Platz gefunden.
    //
    // Der echte Fall: Marina konnte nur montags, Justine montags nicht
    // (ihr Fenster begann nach dem Ende des Unterrichtstags). Drei
    // Kilometer auseinander, also nach Distanz ein perfektes Paar — und
    // beide flogen aus dem Plan.
    const getrennt: PlanSchueler[] = [
      { ...nah[0], moeglicheTage: [1] },
      { ...nah[1], moeglicheTage: [4] },
    ];
    expect(haversineMeter(getrennt[0], getrennt[1])).toBeLessThan(
      MAX_PAAR_DISTANZ_M
    );
    const p = paareZweiwoechentliche(getrennt);
    expect(p).toHaveLength(2);
    expect(p.every((x) => (x.gerade === null) !== (x.ungerade === null))).toBe(
      true
    );
  });

  it("verteilt Alleinstehende abwechselnd auf beide Wochen", () => {
    // Vorher landete jeder ohne Partner auf „gerade". Bei drei
    // zweiwöchentlichen Schülern stand damit die komplette ungerade Woche
    // leer, während die gerade voll war — dieselbe Arbeit, ungleich
    // verteilt, und in der leeren Woche fährt David für einen einzigen
    // Termin dieselbe Strecke.
    const drei: PlanSchueler[] = [
      { ...nah[0], id: "a", moeglicheTage: [1] },
      { ...nah[1], id: "b", moeglicheTage: [2] },
      { ...nah[0], id: "c", moeglicheTage: [3] },
    ];
    const p = paareZweiwoechentliche(drei);
    expect(p).toHaveLength(3);
    const gerade = p.filter((x) => x.gerade !== null).length;
    const ungerade = p.filter((x) => x.ungerade !== null).length;
    // Drei lassen sich nicht exakt halbieren, aber der Abstand darf nie
    // grösser als eins sein.
    expect(Math.abs(gerade - ungerade)).toBeLessThanOrEqual(1);
  });

  it("hält sich an eine gewünschte Woche", () => {
    // **Gleicher Tag und nahe beieinander**: Alles andere spricht für ein
    // Paar, allein der doppelte Wunsch verhindert es. Ohne diesen Aufbau
    // scheiterte das Paar schon an der Tagesprüfung, und der Test wäre auch
    // dann grün geblieben, wenn der Wunsch gar nicht beachtet würde — genau
    // das hat die Gegenprobe gezeigt.
    const p = paareZweiwoechentliche([
      { ...nah[0], id: "a", moeglicheTage: [1], kwPraeferenz: "ungerade" },
      { ...nah[1], id: "b", moeglicheTage: [1], kwPraeferenz: "ungerade" },
    ]);
    // Beide wollen ungerade, also kein Paar — sonst müsste einer von beiden
    // stillschweigend in die gerade Woche.
    expect(p).toHaveLength(2);
    expect(p.every((x) => x.gerade === null && x.ungerade !== null)).toBe(true);
  });

  it("paart die beiden sofort, sobald einer die andere Woche will", () => {
    // Gegenprobe zum Test darüber: Der Wunsch darf das Paaren nicht
    // generell verhindern, sondern nur bei zweimal demselben.
    const p = paareZweiwoechentliche([
      { ...nah[0], id: "a", moeglicheTage: [1], kwPraeferenz: "ungerade" },
      { ...nah[1], id: "b", moeglicheTage: [1], kwPraeferenz: "gerade" },
    ]);
    expect(p).toHaveLength(1);
    expect(p[0].ungerade?.id).toBe("a");
    expect(p[0].gerade?.id).toBe("b");
  });

  it("dreht ein Paar so, wie der Wunsch es verlangt", () => {
    const p = paareZweiwoechentliche([
      { ...nah[0], id: "a", kwPraeferenz: "ungerade" },
      { ...nah[1], id: "b" },
    ]);
    expect(p).toHaveLength(1);
    expect(p[0].ungerade?.id).toBe("a");
    expect(p[0].gerade?.id).toBe("b");
  });

  it("nimmt die eingestellte Distanzgrenze statt der festen", () => {
    // 4,5 km auseinander: bei 4 km kein Paar, bei 5 km eines. Genau der
    // Fall Maurice/Justine, der die Einstellung nötig gemacht hat.
    const knapp: PlanSchueler[] = [
      { ...nah[0], id: "a", lat: 47.5439949, lng: 8.7049122 },
      { ...nah[1], id: "b", lat: 47.5763626, lng: 8.6693964 },
    ];
    const d = haversineMeter(knapp[0], knapp[1]);
    expect(d).toBeGreaterThan(4000);
    expect(d).toBeLessThan(5000);
    expect(paareZweiwoechentliche(knapp, 4000)).toHaveLength(2);
    expect(paareZweiwoechentliche(knapp, 5000)).toHaveLength(1);
  });

  it("reicht die eingestellte Grenze bis in den fertigen Plan durch", () => {
    // Der Test darüber ruft die Paarung direkt auf und sagt deshalb nichts
    // darüber, ob `planeRouten` den eingestellten Wert überhaupt benutzt.
    // Die Gegenprobe hat genau das aufgedeckt: Grenze fest verdrahtet, Test
    // trotzdem grün. Also hier durch die ganze Kette.
    const zwei: PlanSchueler[] = [
      {
        id: "a",
        name: "A",
        lat: 47.5439949,
        lng: 8.7049122,
        rhythmus: "zweiwoechentlich",
        lektionMinuten: 45,
      },
      {
        id: "b",
        name: "B",
        lat: 47.5763626,
        lng: 8.6693964,
        rhythmus: "zweiwoechentlich",
        lektionMinuten: 45,
      },
    ];
    const basis = {
      zuhause: { lat: 47.5282, lng: 8.6696 },
      schueler: zwei,
      fenster: [{ wochentag: 4, beginn: "16:00", ende: "20:30" }],
      pufferMinuten: 15,
    };

    const eng = planeRouten({ ...basis, maxPaarDistanzM: 4000 });
    const weit = planeRouten({ ...basis, maxPaarDistanzM: 5000 });

    const stellen = (p: typeof eng) =>
      p.tage.reduce((n, t) => n + t.positionen.length, 0);

    // Eng: zwei getrennte Plätze. Weit: einer, den sich beide teilen.
    expect(stellen(eng)).toBe(2);
    expect(stellen(weit)).toBe(1);
  });

  it("paart weiterhin, wenn es einen gemeinsamen Tag gibt", () => {
    // Gegenprobe: Die Prüfung darf das Paaren nicht generell verhindern —
    // der geteilte Platz ist der Kapazitätsgewinn.
    const zusammen: PlanSchueler[] = [
      { ...nah[0], moeglicheTage: [1, 4] },
      { ...nah[1], moeglicheTage: [4] },
    ];
    const p = paareZweiwoechentliche(zusammen);
    expect(p).toHaveLength(1);
  });

  it("paart auch ohne Tagesangabe", () => {
    // Keine Angabe heisst „kann an jedem Tag", nicht „kann an keinem".
    const ohne: PlanSchueler[] = [{ ...nah[0] }, { ...nah[1] }];
    expect(paareZweiwoechentliche(ohne)).toHaveLength(1);
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
    // Vier Punkte in einer Linie nach Osten, die günstigste Route ist,
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

describe("Verdichten: früh Verfügbare rutschen an den nächsten Termin heran", () => {
  it("setzt den ersten Schüler so spät wie möglich statt so früh wie möglich", () => {
    // Der echte Fall: Simon kann ab 14:00, Angela erst ab 16:00. Der Planer
    // setzte Simon stur auf 14:00 — 60 Minuten Warten im Auto, obwohl
    // Simon genauso gut später hätte beginnen können. Zeit vor der ersten
    // Lektion ist dagegen frei: David fährt einfach später los.
    const plan = planeRouten({
      zuhause: { lat: 47.5282, lng: 8.6696 },
      schueler: [
        {
          id: "simon",
          name: "Simon",
          lat: 47.52,
          lng: 8.72,
          rhythmus: "woechentlich",
          lektionMinuten: 45,
          // Fenster endet vor Angelas Beginn: Simon MUSS der erste Halt
          // sein, egal wie die Routenoptimierung sortiert.
          fenster: [{ wochentag: 4, fruehestens: "14:00", spaetestens: "16:00" }],
        },
        {
          id: "angela",
          name: "Angela",
          lat: 47.531,
          lng: 8.6647,
          rhythmus: "woechentlich",
          lektionMinuten: 45,
          // Enges Fenster, damit die Reihenfolge feststeht: Angela passt
          // nur um 16:00, Simon muss davor — sonst dreht die
          // Routenoptimierung die beiden und es gibt gar keine Lücke.
          fenster: [{ wochentag: 4, fruehestens: "16:00", spaetestens: "17:00" }],
        },
      ],
      fenster: [{ wochentag: 4, beginn: "14:00", ende: "20:30" }],
      pufferMinuten: 15,
    });

    const tag = plan.tage.find((t) => t.positionen.length === 2);
    expect(tag).toBeDefined();
    const [erster, zweiter] = tag!.positionen;

    // Der Erste beginnt **nach** seiner frühesten Zeit — so spät, dass die
    // Lücke zum Zweiten höchstens dem Raster geschuldet ist.
    expect(erster.beginn > "14:00").toBe(true);

    const ende1 = Number(erster.ende.slice(0, 2)) * 60 + Number(erster.ende.slice(3));
    const start2 = Number(zweiter.beginn.slice(0, 2)) * 60 + Number(zweiter.beginn.slice(3));
    const anfahrt = Math.ceil(zweiter.anfahrtSekunden / 60);
    // Lücke = Fahrt + Puffer + höchstens ein Rasterschritt Luft.
    expect(start2 - ende1).toBeLessThanOrEqual(anfahrt + 15 + 15);

    // Und niemals rutscht dabei die zweite Lektion: Angela bleibt bei 16:00.
    expect(zweiter.beginn).toBe("16:00");
  });

  it("verschiebt nie jemanden über sein eigenes Fenster hinaus", () => {
    // Der Rückwärtsgang darf nur so weit schieben, wie das eigene Fenster
    // reicht — sonst tauscht er Wartezeit gegen einen unmöglichen Termin.
    const plan = planeRouten({
      zuhause: { lat: 47.5282, lng: 8.6696 },
      schueler: [
        {
          id: "a",
          name: "A",
          lat: 47.52,
          lng: 8.72,
          rhythmus: "woechentlich",
          lektionMinuten: 45,
          // Kann NUR 14:00–15:00: Verdichten ist hier unmöglich.
          fenster: [{ wochentag: 4, fruehestens: "14:00", spaetestens: "15:00" }],
        },
        {
          id: "b",
          name: "B",
          lat: 47.531,
          lng: 8.6647,
          rhythmus: "woechentlich",
          lektionMinuten: 45,
          fenster: [{ wochentag: 4, fruehestens: "17:00", spaetestens: "19:00" }],
        },
      ],
      fenster: [{ wochentag: 4, beginn: "14:00", ende: "20:30" }],
      pufferMinuten: 15,
    });

    const tag = plan.tage.find((t) => t.positionen.length === 2);
    expect(tag).toBeDefined();
    // A endet spätestens 15:00 — das Fenster gilt, die Lücke bleibt.
    expect(tag!.positionen[0].ende <= "15:00").toBe(true);
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
            continue; // wöchentlich steht in beiden Wochen, zählt einmal
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

describe("Ein Fenster, das nur halb in den Tag ragt, ist kein möglicher Tag", () => {
  // Der echte Fall vom September-Plan, nachgebaut.
  //
  // Justine hatte montags von 17:30 bis 20:30 Zeit — Davids Montag endete
  // um 18:00. Dreissig Minuten Überschneidung, zu wenig für eine Lektion.
  // Montag galt trotzdem als „möglicher Tag", weil nur der Wochentag
  // verglichen wurde, nicht die Uhrzeit.
  //
  // Folge: Sie wurde mit Marina gepaart, die *nur* montags kann. Ein Paar
  // teilt sich einen Termin, das Paar konnte also nur montags — und dort
  // passte Justine nicht. Beide fielen aus dem Plan, obwohl einzeln beide
  // problemlos Platz gehabt hätten: Marina montags, Justine donnerstags.
  const fenster: Tagesfenster[] = [
    { wochentag: 1, beginn: "16:15", ende: "18:00" },
    { wochentag: 4, beginn: "13:30", ende: "21:00" },
  ];

  const marina: PlanSchueler = {
    id: "m",
    name: "Marina",
    lat: 47.5282,
    lng: 8.6696,
    rhythmus: "zweiwoechentlich",
    lektionMinuten: 45,
    moeglicheTage: [1],
    fenster: [{ wochentag: 1, fruehestens: "17:15", spaetestens: "18:00" }],
  };
  const justine: PlanSchueler = {
    id: "j",
    name: "Justine",
    lat: 47.544,
    lng: 8.7049,
    rhythmus: "zweiwoechentlich",
    lektionMinuten: 45,
    moeglicheTage: [1, 4],
    fenster: [
      // Ragt nur 30 Minuten in den Montag — unmöglich.
      { wochentag: 1, fruehestens: "17:30", spaetestens: "20:30" },
      { wochentag: 4, fruehestens: "17:30", spaetestens: "20:30" },
    ],
  };

  it("paart die beiden nicht", () => {
    const p = paareZweiwoechentliche([marina, justine], MAX_PAAR_DISTANZ_M, fenster);
    expect(p).toHaveLength(2);
  });

  it("bringt beide unter, jeden an seinem Tag", () => {
    const plan = planeRouten(
      eingabe({ schueler: [marina, justine], fenster })
    );
    expect(plan.nichtEingeplant).toHaveLength(0);
    const tagVon = (name: string) =>
      plan.tage.find((t) =>
        t.positionen.some(
          (p) =>
            p.geradeWoche?.name === name || p.ungeradeWoche?.name === name
        )
      )?.wochentag;
    expect(tagVon("Marina")).toBe(1);
    expect(tagVon("Justine")).toBe(4);
  });

  it("ohne Tagesfenster bleibt die grobe Prüfung", () => {
    // Ohne die Unterrichtstage ist schlicht nicht bekannt, wie lang der Tag
    // ist. Dann darf weiterhin nach Wochentag gepaart werden — sonst würde
    // die Rückwärtskompatibilität der Funktion brechen.
    const p = paareZweiwoechentliche([marina, justine]);
    expect(p).toHaveLength(1);
  });
});

describe("Lieber ein voller Abend als zwei halbe", () => {
  it("legt zwei Schüler auf denselben Tag, wenn beide dort können", () => {
    // Vorher suchte die Tagesvergabe ausdrücklich einen **unbenutzten**
    // Tag. Zwei Schüler, die zusammen an einen Abend gepasst hätten,
    // bekamen so je einen eigenen — mit eigener Anfahrt, eigenem Heimweg
    // und einem Abend, der sonst frei geblieben wäre.
    const zwei: PlanSchueler[] = [
      {
        id: "a",
        name: "A",
        lat: 47.5266,
        lng: 8.6706,
        rhythmus: "woechentlich",
        lektionMinuten: 45,
        moeglicheTage: [4],
      },
      {
        id: "b",
        name: "B",
        lat: 47.5471,
        lng: 8.7053,
        rhythmus: "woechentlich",
        lektionMinuten: 45,
        // Kann an beiden Tagen — der Planer hat also die Wahl.
        moeglicheTage: [3, 4],
      },
    ];
    const plan = planeRouten(
      eingabe({
        schueler: zwei,
        fenster: [
          { wochentag: 3, beginn: "16:30", ende: "20:30" },
          { wochentag: 4, beginn: "16:30", ende: "20:30" },
        ],
      })
    );
    const mitLektionen = plan.tage.filter((t) => t.positionen.length > 0);
    expect(mitLektionen).toHaveLength(1);
    expect(plan.nichtEingeplant).toHaveLength(0);
  });

  it("öffnet trotzdem einen zweiten Tag, wenn der erste voll ist", () => {
    // Stures Bündeln wäre der umgekehrte Fehler: Ein übervoller Tag
    // drängt am Ende jemanden ganz aus dem Plan.
    const viele: PlanSchueler[] = ORTE.slice(0, 6).map(
      ([name, lat, lng], i) => ({
        id: `v${i}`,
        name,
        lat,
        lng,
        rhythmus: "woechentlich" as const,
        lektionMinuten: 45,
      })
    );
    const plan = planeRouten(
      eingabe({
        schueler: viele,
        fenster: [
          { wochentag: 3, beginn: "16:30", ende: "18:00" },
          { wochentag: 4, beginn: "16:30", ende: "20:30" },
        ],
      })
    );
    const mitLektionen = plan.tage.filter((t) => t.positionen.length > 0);
    expect(mitLektionen.length).toBeGreaterThan(1);
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
    // günstiger als fünf halbleere.
    //
    // Seit die Zeiten auf dem Viertelstunden-Raster liegen, passt in die
    // 4-Tage-Variante dieses dicht gepackten Modells eine halbe Lektion
    // weniger als in die 5-Tage-Variante. Das ist kein Fehler, sondern der
    // ausgewiesene Preis des Rasters: merkbare Zeiten kosten Minuten.
    // Verglichen wird deshalb die Fahrzeit je Lektion, die von der leicht
    // unterschiedlichen Lektionszahl nicht verzerrt wird.
    const vier = varianten.find((v) => v.tage === 4);
    const fuenf = varianten.find((v) => v.tage === 5);
    expect(vier).toBeDefined();
    expect(fuenf).toBeDefined();
    expect(fuenf!.lektionenProWoche - vier!.lektionenProWoche).toBeLessThanOrEqual(0.5);
    expect(vier!.fahrzeitProWoche).toBeLessThan(fuenf!.fahrzeitProWoche);
    expect(vier!.fahrzeitProLektion).toBeLessThan(fuenf!.fahrzeitProLektion);
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

/**
 * An Hochschultagen beginnt der Abend woanders.
 *
 * David hat an manchen Tagen Unterricht an der PHZH in Zürich und fährt von
 * dort direkt zum ersten Schüler. Der Routenplaner nahm bisher an, jeder
 * Abend starte zuhause in Neftenbach.
 *
 * Der Unterschied ist nicht kosmetisch, sondern dreht die Reihenfolge um:
 * Von zuhause ist Neftenbach der naheliegende erste Halt und Winterthur ein
 * Umweg — von Zürich HB aus genau umgekehrt. Ein falsch geordneter Abend
 * sieht dabei völlig plausibel aus, was ihn gefährlich macht.
 *
 * Der Heimweg bleibt der Heimweg: Am Ende fährt er nach Hause, nicht zurück
 * zur Hochschule.
 */
describe("Startpunkt pro Wochentag", () => {
  const NEFTENBACH = { lat: 47.5266, lng: 8.6706 };
  const ZUERICH_HB = { lat: 47.3779, lng: 8.5403 };

  // Einer nah bei zuhause, einer auf halbem Weg nach Zürich.
  const nahZuhause = {
    id: "nah",
    name: "Nah",
    lat: 47.53,
    lng: 8.67,
    rhythmus: "woechentlich" as const,
    lektionMinuten: 45,
  };
  const richtungZuerich = {
    id: "winti",
    name: "Winterthur",
    lat: 47.4995,
    lng: 8.7241,
    rhythmus: "woechentlich" as const,
    lektionMinuten: 45,
  };

  function planeMit(start: { lat: number; lng: number } | null) {
    return planeRouten({
      zuhause: NEFTENBACH,
      schueler: [nahZuhause, richtungZuerich],
      fenster: [
        {
          wochentag: 1,
          beginn: "16:30",
          ende: "20:30",
          start,
          startName: start ? "PHZH Lagerstrasse" : null,
        },
      ],
      pufferMinuten: 15,
    });
  }

  it("ordnet den Abend anders, wenn er woanders beginnt", () => {
    const vonZuhause = planeMit(null);
    const vonZuerich = planeMit(ZUERICH_HB);

    const ersterVonZuhause =
      vonZuhause.tage[0].positionen[0].geradeWoche?.id;
    const ersterVonZuerich =
      vonZuerich.tage[0].positionen[0].geradeWoche?.id;

    // Von zuhause zuerst der Nachbar, von Zürich zuerst der auf dem Weg.
    expect(ersterVonZuhause).toBe("nah");
    expect(ersterVonZuerich).toBe("winti");
  });

  it("führt am Ende trotzdem nach Hause", () => {
    const vonZuerich = planeMit(ZUERICH_HB);
    // Der Heimweg wird gegen Neftenbach gerechnet, nicht gegen Zürich.
    // Wäre es Zürich, wäre er von Winterthur aus deutlich länger.
    expect(vonZuerich.tage[0].heimwegSekunden).toBeGreaterThan(0);
    const heimwegNachZuerich = planeRouten({
      zuhause: ZUERICH_HB,
      schueler: [nahZuhause, richtungZuerich],
      fenster: [{ wochentag: 1, beginn: "16:30", ende: "20:30" }],
      pufferMinuten: 15,
    }).tage[0].heimwegSekunden;
    expect(vonZuerich.tage[0].heimwegSekunden).not.toBe(heimwegNachZuerich);
  });

  it("reicht den Namen für die Anzeige durch", () => {
    // Ohne ihn stünde im Plan „Abfahrt zuhause", und die Abfahrtszeit wäre
    // für den falschen Ort gerechnet.
    expect(planeMit(ZUERICH_HB).tage[0].startName).toBe("PHZH Lagerstrasse");
    expect(planeMit(null).tage[0].startName).toBeNull();
  });

  it("verhält sich ohne Startpunkt wie bisher", () => {
    const ohneFeld = planeRouten({
      zuhause: NEFTENBACH,
      schueler: [nahZuhause, richtungZuerich],
      fenster: [{ wochentag: 1, beginn: "16:30", ende: "20:30" }],
      pufferMinuten: 15,
    });
    const mitNull = planeMit(null);
    expect(mitNull.fahrzeitProWoche).toBe(ohneFeld.fahrzeitProWoche);
  });
});
