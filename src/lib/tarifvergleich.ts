// ============================================================
// Vergleich mit dem Tarifblatt des SMPV
//
// Der Schweizerische Musikpädagogische Verband veröffentlicht jährlich
// empfohlene Mindesttarife, nach Region getrennt. Für Winterthur und das
// Zürcher Oberland stehen dort CHF 110 für eine Lektion à 60 Minuten
// (Erwachsene, im Semesterabonnement).
//
// ── Warum umgerechnet wird ──────────────────────────────────
//
// Eine Lektion dauert hier 45 Minuten, beim SMPV sind es 60. CHF 65 neben
// CHF 110 zu stellen sähe grossartig aus und wäre eine Täuschung: Man
// vergliche drei Viertel einer Stunde mit einer ganzen. Deshalb rechnet
// diese Datei alles auf 60 Minuten hoch, bevor irgendetwas nebeneinander
// steht.
//
// ── Was dabei herauskommt ───────────────────────────────────
//
// Die Abos liegen unter der Empfehlung, die Einzellektion liegt leicht
// darüber. Das ist ein schwächeres Argument als erhofft, aber es ist das
// wahre, und es hält der Nachfrage stand: Wer das PDF öffnet, findet
// dieselben Zahlen.
// ============================================================

/** Quelle der Empfehlung, damit jeder nachsehen kann. */
export const SMPV_TARIFBLATT =
  "https://smpv.ch/wp-content/uploads/2025-TarifeTarifs.pdf";

export const SMPV_REGION = "Winterthur und Zürcher Oberland";

/** Empfohlener Mindesttarif für Erwachsene, Lektion à 60 Minuten. */
export const SMPV_STUNDE = 110;

/**
 * Das Tarifblatt empfiehlt für Kinder und Jugendliche bis zum 20.
 * Altersjahr eine Reduktion von höchstens 20 Prozent.
 *
 * Auf der Preisseite steht diese Zahl bewusst nicht. Sie ist eine
 * Empfehlung des Verbands, keine Grösse, mit der David wirbt, und wer sie
 * sucht, findet sie im verlinkten PDF. Hier bleibt sie stehen, damit
 * nachvollziehbar ist, dass sie bedacht und nicht übersehen wurde: Das
 * Halbjahresabo läge mit CHF 93 darüber.
 */
export const SMPV_JUGEND_RABATT = 0.2;

export const SMPV_STUNDE_JUGEND = SMPV_STUNDE * (1 - SMPV_JUGEND_RABATT);

/** Die eigene Lektionsdauer in Minuten. */
export const LEKTION_MINUTEN = 45;

/**
 * Ein 45-Minuten-Preis auf eine volle Stunde hochgerechnet.
 *
 * Kaufmännisch gerundet auf ganze Franken: Rappen suggerieren eine
 * Genauigkeit, die ein Vergleich von Empfehlungen nicht hat.
 */
export function proStunde(preis45: number): number {
  return Math.round((preis45 / LEKTION_MINUTEN) * 60);
}

export type Vergleichszeile = {
  bezeichnung: string;
  /** Preis für 45 Minuten, so wie er auf der Seite steht. */
  preis45: number;
  /** Derselbe Preis auf 60 Minuten. */
  preis60: number;
  /** Unter der SMPV-Empfehlung für Erwachsene? */
  unterEmpfehlung: boolean;
};

export function vergleiche(
  angebote: { bezeichnung: string; preis45: number }[],
): Vergleichszeile[] {
  return angebote.map(({ bezeichnung, preis45 }) => {
    const preis60 = proStunde(preis45);
    return {
      bezeichnung,
      preis45,
      preis60,
      unterEmpfehlung: preis60 < SMPV_STUNDE,
    };
  });
}

/** Die eigenen Angebote, in derselben Reihenfolge wie auf der Preisseite. */
export const EIGENE_ANGEBOTE = [
  { bezeichnung: "Einzellektion", preis45: 85 },
  { bezeichnung: "Halbjahresabo", preis45: 70 },
  { bezeichnung: "Jahresabo", preis45: 65 },
];
