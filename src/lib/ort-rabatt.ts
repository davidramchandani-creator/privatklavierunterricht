// ============================================================
// Unterricht bei David: 5 % Rabatt
//
// Wer zu David nach Hause kommt, statt dass er hinfährt, zahlt 5 % weniger
// pro Lektion. Gilt auf alle Preise: Einzellektion, Pakete, Abos,
// Zusatzlektionen. (Angabe David, 28. Oktober 2026.)
//
// Ob jemand kommt, stellt nur David ein, mit dem Schalter „Ich fahre hin"
// auf der Schülerseite (`profiles.hausbesuch`). Aus bedeutet: kommt zu
// David, und damit gilt der Rabatt.
//
// Gespeichert bleiben die normalen Preise des Schülers. Der Rabatt wird
// beim Rechnen abgezogen, an dieser einen Stelle. So stimmt die Zahl
// überall gleich, und wer wieder zum Hausbesuch wechselt, hat sofort
// seinen alten Preis.
//
// Reine Funktionen.
// ============================================================

import { roundRappen } from "./subscription";

export const ORT_RABATT_PROZENT = 5;

/**
 * Wo der Unterricht bei David stattfindet. Öffentlich auf der Webseite
 * steht nur der Ort; die genaue Adresse sehen angemeldete Schüler, die zu
 * David kommen (Portal, Kalender).
 */
export const DAVIDS_ADRESSE = "Sattleracherstrasse 59, 8413 Neftenbach";
export const DAVIDS_ORT = "Neftenbach";

/** Kommt der Schüler zu David? Nur ein ausdrückliches `false` zählt. */
export function kommtZuDavid(hausbesuch: boolean | null | undefined): boolean {
  return hausbesuch === false;
}

/** Faktor auf den Preis: 0.95 bei Unterricht bei David, sonst 1. */
export function ortFaktor(hausbesuch: boolean | null | undefined): number {
  return kommtZuDavid(hausbesuch) ? 1 - ORT_RABATT_PROZENT / 100 : 1;
}

/** Preis pro Lektion nach Ort, auf 5 Rappen gerundet. */
export function mitOrtRabatt(
  preis: number,
  hausbesuch: boolean | null | undefined
): number {
  if (!kommtZuDavid(hausbesuch)) return preis;
  return roundRappen(preis * ortFaktor(hausbesuch));
}

/**
 * Einen bestehenden Betrag beim Wechsel umrechnen.
 *
 * Zu David: −5 %. Zurück zum Hausbesuch: wieder auf den vollen Betrag. Für
 * die noch nicht gestellten Raten eines laufenden Abos.
 */
export function umrechnenBeiWechsel(betrag: number, kommtJetztZuDavid: boolean): number {
  const f = 1 - ORT_RABATT_PROZENT / 100;
  return roundRappen(kommtJetztZuDavid ? betrag * f : betrag / f);
}
