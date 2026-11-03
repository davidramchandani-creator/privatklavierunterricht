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
// Seit den neuen Preisen vom November 2026 liegt nur noch das Jahresabo
// unter der Empfehlung, Semesterabo und Einzellektion darüber. Der Satz
// dazu auf der Preisseite wird aus den Zahlen gebaut (`vergleichsSatz`),
// damit er nach der nächsten Preisänderung nicht wieder falsch ist. Wer das
// PDF öffnet, findet dieselben Zahlen.
// ============================================================

import { NEUPREISE } from "./neupreise";

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
  { bezeichnung: "Einzellektion", preis45: NEUPREISE.einzel },
  { bezeichnung: "Semesterabo", preis45: NEUPREISE.semester },
  { bezeichnung: "Jahresabo", preis45: NEUPREISE.jahr },
];

function aufzaehlen(namen: string[]): string {
  if (namen.length <= 1) return namen.join("");
  return `${namen.slice(0, -1).join(", ")} und ${namen[namen.length - 1]}`;
}

/**
 * Der Satz unter der Vergleichstabelle, aus den Zahlen gebaut.
 *
 * Vorher stand dort fest „Die Abos liegen damit unter der Empfehlung, die
 * Einzellektion knapp darüber“. Mit den neuen Preisen stimmte das nicht
 * mehr, und genau so ein Satz fällt beim Nachrechnen auf.
 */
export function vergleichsSatz(zeilen: Vergleichszeile[]): string {
  const unter = zeilen.filter((z) => z.unterEmpfehlung).map((z) => z.bezeichnung);
  const ueber = zeilen.filter((z) => !z.unterEmpfehlung).map((z) => z.bezeichnung);
  if (ueber.length === 0) return "Alle Angebote liegen damit unter der Empfehlung.";
  if (unter.length === 0) return "Alle Angebote liegen damit über der Empfehlung.";
  const verbU = unter.length === 1 ? "liegt" : "liegen";
  return `${aufzaehlen(unter)} ${verbU} damit unter der Empfehlung, ${aufzaehlen(ueber)} darüber.`;
}
