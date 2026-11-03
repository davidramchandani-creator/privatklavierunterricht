// ============================================================
// Preise für neue Schüler
//
// David, 3. November 2026: Er ist fast ausgebucht. Neue Schüler zahlen
// darum ab sofort mehr, bestehende behalten ihren Preis, bis David ihn
// im Admin pro Schüler ändert.
//
// Zuerst 100 / 85 / 80, noch am selben Tag auf 97.50 / 82.50 / 77.50: Das
// Semesterabo entspricht so genau dem Richtwert des SMPV (CHF 110 pro
// 60 Minuten, auf 45 Minuten umgerechnet 82.50). Die Abstände zwischen
// den drei Preisen sind geblieben.
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
  einzel: 97.5,
  /** Semesterabo, pro Lektion. Genau der SMPV-Richtwert auf 45 Minuten. */
  semester: 82.5,
  /** Jahresabo, pro Lektion. */
  jahr: 77.5,
} as const;

/** Wie viel Prozent ein Abo gegenüber der Einzellektion spart, gerundet. */
export function rabattGegenueberEinzel(preis: number): number {
  return Math.round(((NEUPREISE.einzel - preis) / NEUPREISE.einzel) * 100);
}

/** „85“ oder „82.50“, nie „82.5“. */
export function betrag(wert: number): string {
  return Number.isInteger(wert) ? String(wert) : wert.toFixed(2);
}

/** „CHF 85.–“ oder „CHF 82.50“ */
export function chf(wert: number): string {
  return Number.isInteger(wert) ? `CHF ${wert}.–` : `CHF ${wert.toFixed(2)}`;
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
