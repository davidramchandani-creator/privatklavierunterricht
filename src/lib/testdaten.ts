// ============================================================
// Testdaten
//
// Zweck: den Planungsablauf einmal ganz durchspielen, ohne dass ein echter
// Schüler Post bekommt oder einen Termin gesetzt kriegt.
//
// Testschüler sind bewusst **normale** Schüler mit einem Merker (`ist_test`),
// keine Sonderform. Nur so testet man den Ablauf, den man später wirklich
// fährt — eine Attrappe würde genau die Fehler verstecken, die man sucht.
//
// Die Adressen sind echte Ortschaften rund um Neftenbach, in verschiedene
// Richtungen verteilt. Das ist keine Kosmetik: die Routenrechnung gruppiert
// nach Fahrtrichtung, und mit fünf Adressen im selben Dorf sähe jede
// Zuteilung gut aus.
// ============================================================

export type TestSchueler = {
  vorname: string;
  nachname: string;
  adresse: string;
  /** Richtung von Neftenbach aus – erklärt, was der Fall prüfen soll. */
  zweck: string;
  variante: "halbjahr" | "jahr";
  rhythmus: "woechentlich" | "zweiwoechentlich";
  /** Zeiten, die dieser Schüler „angeben" würde. */
  verfuegbarkeit: {
    wochentag: number;
    fruehestens: string;
    spaetestens: string;
    praeferenz: number;
  }[];
};

/** Kennzeichnet Testkonten eindeutig – danach wird auch aufgeräumt. */
export const TEST_EMAIL_DOMAIN = "test.privatklavierunterricht.ch";

export function testEmail(index: number): string {
  return `testschueler${index + 1}@${TEST_EMAIL_DOMAIN}`;
}

/**
 * Fünf Fälle, die zusammen die Regeln abdecken, an denen es scheitern kann.
 */
export const TEST_SCHUELER: TestSchueler[] = [
  {
    vorname: "Anna",
    nachname: "Testschülerin",
    adresse: "Bahnhofstrasse 10, 8412 Aesch bei Neftenbach",
    zweck:
      "Direkt nebenan. Muss praktisch gratis sein – wenn der Planer hier viel Fahrzeit ausweist, stimmt die Rechnung nicht.",
    variante: "halbjahr",
    rhythmus: "woechentlich",
    verfuegbarkeit: [
      { wochentag: 2, fruehestens: "16:30", spaetestens: "20:30", praeferenz: 3 },
      { wochentag: 3, fruehestens: "16:30", spaetestens: "20:30", praeferenz: 2 },
    ],
  },
  {
    vorname: "Bruno",
    nachname: "Testschüler",
    adresse: "Dorfstrasse 5, 8422 Pfungen",
    zweck:
      "Südwestlich, auf dem Weg nach Winterthur. Sollte mit Winterthur auf denselben Abend fallen.",
    variante: "halbjahr",
    rhythmus: "woechentlich",
    verfuegbarkeit: [
      { wochentag: 2, fruehestens: "17:00", spaetestens: "20:30", praeferenz: 3 },
      { wochentag: 4, fruehestens: "16:30", spaetestens: "20:30", praeferenz: 1 },
    ],
  },
  {
    vorname: "Clara",
    nachname: "Testschülerin",
    adresse: "Technikumstrasse 9, 8400 Winterthur",
    zweck:
      "Stadt, dieselbe Richtung wie Pfungen. Prüft, ob die Gruppierung nach Fahrtrichtung greift.",
    variante: "jahr",
    rhythmus: "zweiwoechentlich",
    verfuegbarkeit: [
      { wochentag: 2, fruehestens: "18:00", spaetestens: "20:30", praeferenz: 3 },
    ],
  },
  {
    vorname: "David",
    nachname: "Testschüler",
    adresse: "Hauptstrasse 12, 8352 Elsau",
    zweck:
      "Östlich, andere Richtung. Darf nicht mit Pfungen zusammengelegt werden, obwohl die Luftlinie kurz ist.",
    variante: "jahr",
    rhythmus: "zweiwoechentlich",
    verfuegbarkeit: [
      { wochentag: 2, fruehestens: "18:00", spaetestens: "20:30", praeferenz: 3 },
      { wochentag: 5, fruehestens: "16:30", spaetestens: "18:00", praeferenz: 2 },
    ],
  },
  {
    vorname: "Elena",
    nachname: "Testschülerin",
    adresse: "Schulhausstrasse 3, 8451 Kleinandelfingen",
    zweck:
      "Weit im Norden. Der teure Fall – zeigt, was ein einzelner Aussenposten an einem Abend kostet.",
    variante: "halbjahr",
    rhythmus: "woechentlich",
    verfuegbarkeit: [
      { wochentag: 3, fruehestens: "16:30", spaetestens: "19:00", praeferenz: 3 },
    ],
  },
];

/**
 * Absichtlich enge Zeiten bei Clara und Elena: erst dann zeigt sich, ob die
 * Zuteilung knappe Verfügbarkeiten zuerst bedient. Wenn alle immer können,
 * ist jede Zuteilung richtig und der Test sagt nichts aus.
 */
export const TEST_HINWEIS =
  "Clara und Elena können nur an einem Tag – wenn die Zuteilung stimmt, bekommen sie ihren Platz zuerst.";
