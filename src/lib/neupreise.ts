// ============================================================
// Preise für neue Schüler
//
// David, 3. November 2026: Er ist fast ausgebucht. Neue Schüler zahlen
// darum ab sofort mehr, bestehende behalten ihren Preis, bis David ihn
// im Admin pro Schüler ändert.
//
// Diese Datei ist die einzige Stelle, an der die öffentlichen Preise
// stehen. Webseite, FAQ, strukturierte Daten, Tarifvergleich und die
// Standardwerte für neu angelegte Schüler lesen von hier. Wer die Preise
// ändert, ändert sie hier und in der Datenbank-Vorgabe (Migration), sonst
// stimmen Webseite und neue Profile nicht mehr überein.
//
// Bestehende Schüler sind davon nicht betroffen: Ihr Preis steht in
// `profiles.price_*` und im laufenden Abo (`packages.price_per_lesson`).
// ============================================================

import { roundRappen } from "./subscription";

export const NEUPREISE = {
  /** Einzellektion, 45 Minuten. */
  einzel: 100,
  /** Semesterabo, pro Lektion. */
  semester: 85,
  /** Jahresabo, pro Lektion. */
  jahr: 80,
} as const;

/** Wie viel Prozent ein Abo gegenüber der Einzellektion spart, gerundet. */
export function rabattGegenueberEinzel(preis: number): number {
  return Math.round(((NEUPREISE.einzel - preis) / NEUPREISE.einzel) * 100);
}

/** „CHF 85.–“ */
export function chf(betrag: number): string {
  return Number.isInteger(betrag) ? `CHF ${betrag}.–` : `CHF ${betrag.toFixed(2)}`;
}

/**
 * Monatsrate für ein Preisbeispiel: Lektionen × Preis, verteilt auf die
 * Monate, auf 5 Rappen gerundet wie bei den echten Raten.
 */
export function beispielMonatsrate(
  lektionen: number,
  preisProLektion: number,
  monate: number
): number {
  return roundRappen((lektionen * preisProLektion) / monate);
}
