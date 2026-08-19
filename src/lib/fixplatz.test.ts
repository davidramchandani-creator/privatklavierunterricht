import { describe, expect, it } from "vitest";
import {
  ausweichKandidaten,
  describeFixplatz,
  firstSeriesStart,
  fixplatzSeriesStarts,
  fixplatzTauglich,
  pruefeFixplatzSerie,
  serieInnerhalbLaufzeit,
  type FixplatzWunsch,
} from "./fixplatz";
import {
  computeAvailableSlots,
  utcToZonedDate,
  type AvailabilityContext,
} from "./booking";

// Sonntag, 09.08.2026, 12:00 Zürcher Zeit
const JETZT = new Date("2026-08-09T10:00:00Z");

function ctx(over: Partial<AvailabilityContext> = {}): AvailabilityContext {
  return {
    studentId: "s1",
    bufferMin: 15,
    now: JETZT,
    appointments: [],
    absences: [],
    timeBlocks: [],
    timeBlockRules: [],
    ...over,
  };
}

/** Zürcher Lokalzeit als "HH:MM", für DST-Prüfungen. */
function lokalzeit(d: Date): string {
  return d.toLocaleTimeString("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DI_1715: FixplatzWunsch = {
  weekday: 2,
  time: "17:15",
  rhythmus: "woechentlich",
  lessons: 10,
};

describe("Serienstart", () => {
  it("nimmt den nächsten passenden Wochentag", () => {
    const start = firstSeriesStart(DI_1715, JETZT, null);
    // Sonntag 09.08. → nächster Dienstag ist der 11.08.
    expect(start.toISOString().slice(0, 10)).toBe("2026-08-11");
    expect(lokalzeit(start)).toBe("17:15");
  });

  it("hält die 24-Stunden-Regel ein", () => {
    // Montag 12:00, der Dienstag ist dann nur noch ~29 h weg, das passt.
    const montag = new Date("2026-08-10T10:00:00Z");
    expect(firstSeriesStart(DI_1715, montag, null).toISOString().slice(0, 10)).toBe(
      "2026-08-11"
    );
    // Dienstag früh, derselbe Dienstag ist zu knapp, es wird der nächste.
    const dienstagFrueh = new Date("2026-08-11T05:00:00Z");
    expect(
      firstSeriesStart(DI_1715, dienstagFrueh, null).toISOString().slice(0, 10)
    ).toBe("2026-08-18");
  });

  it("berücksichtigt die gewünschte Wochenparität", () => {
    const gerade = firstSeriesStart(DI_1715, JETZT, 0);
    const ungerade = firstSeriesStart(DI_1715, JETZT, 1);
    expect(ungerade.toISOString().slice(0, 10)).toBe("2026-08-11");
    expect(gerade.toISOString().slice(0, 10)).toBe("2026-08-18");
  });
});

describe("Serientermine", () => {
  it("erzeugt wöchentlich 10 Termine im 7-Tage-Abstand", () => {
    const starts = fixplatzSeriesStarts(DI_1715, firstSeriesStart(DI_1715, JETZT, null));
    expect(starts).toHaveLength(10);
    expect(starts[0].toISOString().slice(0, 10)).toBe("2026-08-11");
    expect(starts[9].toISOString().slice(0, 10)).toBe("2026-10-13");
    for (const s of starts) expect(s.getUTCDay()).toBe(2);
  });

  it("erzeugt zweiwöchentlich im 14-Tage-Abstand", () => {
    const w: FixplatzWunsch = { ...DI_1715, rhythmus: "zweiwoechentlich", lessons: 20 };
    const starts = fixplatzSeriesStarts(w, firstSeriesStart(w, JETZT, null));
    expect(starts).toHaveLength(20);
    const tage =
      (starts[19].getTime() - starts[0].getTime()) / 86400000;
    expect(tage).toBe(19 * 14);
  });

  it("bleibt über die Sommerzeitumstellung auf derselben Uhrzeit", () => {
    // 20 Lektionen zweiwöchentlich ab August laufen bis in den Mai und
    // überqueren beide Umstellungen. Ein reines "+7 Tage in Millisekunden"
    // würde die Lektion im Herbst eine Stunde früher legen.
    const w: FixplatzWunsch = {
      weekday: 4,
      time: "18:00",
      rhythmus: "zweiwoechentlich",
      lessons: 20,
    };
    const starts = fixplatzSeriesStarts(w, firstSeriesStart(w, JETZT, null));
    const zeiten = new Set(starts.map(lokalzeit));
    expect([...zeiten]).toEqual(["18:00"]);

    // Gegenprobe: die UTC-Zeit muss sich ändern, sonst wäre nichts korrigiert.
    const utcZeiten = new Set(starts.map((s) => s.toISOString().slice(11, 16)));
    expect(utcZeiten.size).toBeGreaterThan(1);
  });
});

describe("Serienprüfung", () => {
  it("meldet eine freie Serie als vollständig buchbar", () => {
    const first = firstSeriesStart(DI_1715, JETZT, null);
    const p = pruefeFixplatzSerie(DI_1715, first, ctx());
    expect(p.freie).toBe(10);
    expect(p.vollstaendigFrei).toBe(true);
    expect(fixplatzTauglich(p)).toBe(true);
  });

  it("markiert einzelne Termine als belegt, ohne die Serie zu verwerfen", () => {
    const first = firstSeriesStart(DI_1715, JETZT, null);
    const p = pruefeFixplatzSerie(
      DI_1715,
      first,
      ctx({
        absences: [
          {
            scope: "admin",
            student_id: null,
            start_date: "2026-08-18",
            end_date: "2026-08-18",
          },
        ],
      })
    );
    expect(p.freie).toBe(9);
    expect(p.vollstaendigFrei).toBe(false);
    expect(p.belegte).toHaveLength(1);
    // Eine einzelne Ferienwoche darf den Fixplatz nicht unbrauchbar machen.
    expect(fixplatzTauglich(p)).toBe(true);
  });

  it("hält einen Slot für untauglich, wenn zu vieles kollidiert", () => {
    const first = firstSeriesStart(DI_1715, JETZT, null);
    const p = pruefeFixplatzSerie(
      DI_1715,
      first,
      ctx({
        absences: [
          {
            scope: "admin",
            student_id: null,
            start_date: "2026-08-18",
            end_date: "2026-09-30",
          },
        ],
      })
    );
    expect(fixplatzTauglich(p)).toBe(false);
  });

  it("prüft, ob die Serie in die Laufzeit passt", () => {
    const first = firstSeriesStart(DI_1715, JETZT, null);
    const p = pruefeFixplatzSerie(DI_1715, first, ctx());
    // 10er wöchentlich: Laufzeit bis 09.12.2026, letzte Lektion 13.10.
    expect(serieInnerhalbLaufzeit(p.letzterTermin, "2026-12-09")).toBe(true);
    expect(serieInnerhalbLaufzeit(p.letzterTermin, "2026-09-01")).toBe(false);
  });
});

describe("Ausweichtermine", () => {
  const c = ctx({
    absences: [
      {
        scope: "admin",
        student_id: null,
        start_date: "2026-08-18",
        end_date: "2026-08-18",
      },
    ],
  });
  const first = firstSeriesStart(DI_1715, JETZT, null);
  const pruefung = pruefeFixplatzSerie(DI_1715, first, c);
  const freie = computeAvailableSlots(utcToZonedDate(first), 40, c);
  const vorschlaege = ausweichKandidaten(pruefung.belegte[0].start, freie);

  it("bietet zuerst die gleiche Woche an", () => {
    expect(vorschlaege[0].stufe).toBe(1);
    expect(vorschlaege[0].slot.start.toISOString().slice(0, 10)).toBe("2026-08-19");
  });

  it("bevorzugt die gewohnte Uhrzeit an anderen Tagen", () => {
    // Alle Vorschläge der ersten Stufe liegen um 17:15, die Uhrzeit ist für
    // Schüler das Verbindlichere, nicht der Wochentag.
    for (const v of vorschlaege.filter((x) => x.stufe === 1)) {
      expect(lokalzeit(v.slot.start)).toBe("17:15");
    }
  });

  it("streut über mehrere Tage statt vier Vorschläge am selben Tag", () => {
    const tage = new Set(
      vorschlaege
        .filter((v) => v.stufe === 1)
        .map((v) => v.slot.start.toISOString().slice(0, 10))
    );
    expect(tage.size).toBeGreaterThan(1);
  });

  it("schlägt nie einen Termin vor der ausgefallenen Lektion vor", () => {
    for (const v of vorschlaege) {
      expect(v.slot.start.getTime()).toBeGreaterThan(
        pruefung.belegte[0].start.getTime()
      );
    }
  });

  it("geht nie über zwei Wochen hinaus, danach ist es kein Ersatz mehr", () => {
    const grenze = pruefung.belegte[0].start.getTime() + 15 * 86400000;
    for (const v of vorschlaege) {
      expect(v.slot.start.getTime()).toBeLessThan(grenze);
    }
  });

  it("liefert eine leere Liste, wenn nichts frei ist", () => {
    expect(ausweichKandidaten(pruefung.belegte[0].start, [])).toEqual([]);
  });
});

describe("Beschreibung für die Oberfläche", () => {
  it("formuliert wöchentlich und zweiwöchentlich unterschiedlich", () => {
    expect(describeFixplatz(2, "17:15", "woechentlich")).toBe(
      "Jeden Dienstag um 17:15"
    );
    expect(describeFixplatz(4, "18:00", "zweiwoechentlich", 1)).toBe(
      "Jeden zweiten Donnerstag um 18:00 (ungerade Wochen)"
    );
  });

  it("schneidet Sekunden aus der Datenbankzeit weg", () => {
    expect(describeFixplatz(1, "16:30:00", "woechentlich")).toBe(
      "Jeden Montag um 16:30"
    );
  });
});

/**
 * Die Serie muss die Schulferien überspringen.
 *
 * Der Fehler, den diese Tests festhalten, war lautlos und teuer: Ohne
 * Ferienwissen erzeugte `fixplatzSeriesStarts` schlicht `lessons`
 * aufeinanderfolgende Termine. Ein Jahresabo mit 39 wöchentlichen Lektionen
 * ab dem 14.09.2026 ergab 39 Montage bis zum 07.06.2027 — acht davon in den
 * Herbst-, Weihnachts-, Sport- und Frühlingsferien.
 *
 * Die Folgen standen sich gegenseitig im Weg: Der Schüler hätte Termine an
 * Weihnachten gehabt, seine Serie wäre im Juni ausgelaufen statt im
 * September, und von 39 bezahlten Lektionen wären 31 nutzbare geblieben —
 * während die Bestätigungsmail ihm zusicherte, die Ferien seien bereits
 * abgezogen.
 */
describe("Serie und Schulferien", () => {
  const FERIEN = [
    { start: "2026-10-05", ende: "2026-10-16" },
    { start: "2026-12-21", ende: "2027-01-01" },
    { start: "2027-02-08", ende: "2027-02-19" },
    { start: "2027-04-19", ende: "2027-04-30" },
    { start: "2027-07-19", ende: "2027-08-20" },
  ];

  const jahresabo: FixplatzWunsch = {
    weekday: 1,
    time: "17:00",
    rhythmus: "woechentlich",
    lessons: 39,
  };

  const ersterMontag = new Date("2026-09-14T15:00:00Z");

  function tage(ferien: { start: string; ende: string }[]): string[] {
    return fixplatzSeriesStarts(jahresabo, ersterMontag, ferien).map((d) =>
      d.toISOString().slice(0, 10)
    );
  }

  it("legt keinen Termin in die Ferien", () => {
    const inFerien = tage(FERIEN).filter((t) =>
      FERIEN.some((f) => t >= f.start && t <= f.ende)
    );
    expect(inFerien).toEqual([]);
  });

  it("liefert trotzdem die volle Lektionszahl", () => {
    expect(tage(FERIEN)).toHaveLength(39);
  });

  it("reicht damit bis ans Ende der Abo-Periode", () => {
    const liste = tage(FERIEN);
    const letzter = liste[liste.length - 1];

    // Ohne Ferienwissen endete die Serie am 07.06.2027, fast ein
    // Vierteljahr vor dem Abo-Ende am 13.09.2027.
    expect(letzter > "2027-06-07").toBe(true);
    expect(letzter <= "2027-09-13").toBe(true);
  });

  it("verhält sich ohne Ferienangabe wie bisher", () => {
    // Bestehende Aufrufer, die keine Ferien übergeben, dürfen sich nicht
    // plötzlich anders verhalten.
    const ohne = fixplatzSeriesStarts(jahresabo, ersterMontag);
    expect(ohne).toHaveLength(39);
    expect(ohne[ohne.length - 1].toISOString().slice(0, 10)).toBe("2027-06-07");
  });

  it("zählt zweiwöchentlich in Zweiwochenschritten weiter", () => {
    const zweiwoechentlich = fixplatzSeriesStarts(
      { ...jahresabo, rhythmus: "zweiwoechentlich", lessons: 19 },
      ersterMontag,
      FERIEN
    ).map((d) => d.toISOString().slice(0, 10));

    expect(zweiwoechentlich).toHaveLength(19);
    for (let i = 1; i < zweiwoechentlich.length; i++) {
      const abstand =
        (Date.parse(zweiwoechentlich[i]) - Date.parse(zweiwoechentlich[i - 1])) /
        86400000;
      // 14 Tage im Normalfall, mehr wenn Ferien übersprungen wurden.
      expect(abstand % 14).toBe(0);
    }
  });

  it("bricht ab, statt endlos zu suchen", () => {
    // Ferien über einen absurd langen Zeitraum. Es darf keine
    // Endlosschleife geben, sondern eine kürzere Liste; die fehlenden
    // Termine meldet der Aufrufer.
    const alles = [{ start: "2026-01-01", ende: "2040-01-01" }];
    const ergebnis = fixplatzSeriesStarts(jahresabo, ersterMontag, alles);
    expect(ergebnis).toEqual([]);
  });

  it("sucht weit genug, um lange Ferienblöcke zu überbrücken", () => {
    // Die Sommerferien dauern fünf Wochen. Die Suche darf nicht schon
    // vorher aufgeben, sonst fehlten am Ende der Laufzeit Termine.
    const sommer = [{ start: "2026-09-21", ende: "2026-11-02" }];
    const ergebnis = fixplatzSeriesStarts(
      { ...jahresabo, lessons: 3 },
      ersterMontag,
      sommer
    ).map((d) => d.toISOString().slice(0, 10));

    expect(ergebnis).toEqual(["2026-09-14", "2026-11-09", "2026-11-16"]);
  });
});
