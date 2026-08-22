// ============================================================
// Was der Monat noch bringt
//
// Die Abrechnung zählt, was bezahlt wurde — richtig für die Steuer, aber
// blind für die Gegenwart: Am 5. des Monats steht dort fast nichts, obwohl
// zwanzig Lektionen im Kalender stehen. Diese Datei ergänzt den Blick nach
// vorn.
//
// ── Der Denkfehler, den es zu vermeiden gilt ────────────────
//
// „Erwartete Einnahme = Lektionen mal Preis" stimmt nur für Pakete, die
// **pro Lektion** abgerechnet werden. Bei den anderen Arten entsteht die
// Forderung woanders, und Lektionen zu zählen hiesse, dasselbe Geld ein
// zweites Mal zu erwarten:
//
//   pro_lektion  Nach jeder Lektion eine Rechnung.  → Lektion zählt
//   einmalig     Alles beim Kauf fakturiert.        → Lektion zählt NICHT
//   raten        Anzahlung plus Monatsraten.        → Lektion zählt NICHT,
//                                                     die Rate zählt
//   Abo          Läuft ebenfalls über Monatsraten.  → wie raten
//   extern       Plattform zahlt pro Lektion.       → Lektion zählt
//
// Ein 10er-Paket für 700 Franken, einmalig bezahlt, brächte sonst im
// Kaufmonat 700 und in jedem Folgemonat nochmals 70 pro Lektion.
//
// ── Drei Zahlen statt einer ─────────────────────────────────
//
//   bezahlt   Geld ist da. Diese Zahl geht in die Steuererklärung.
//   gestellt  Rechnung ist raus, Geld fehlt noch.
//   erwartet  Weder Rechnung noch Geld, aber die Lektion steht im Kalender
//             oder die Rate wird fällig.
//
// Zusammengeworfen wäre die Summe zwar grösser, aber wertlos: Man wüsste
// nicht mehr, welcher Teil belegt ist. Genau darum trennt schon die
// Abrechnung Rechnungen von Schätzungen.
//
// Reine Funktionen, kein DB-Zugriff. Der liegt in prognose-server.ts.
// ============================================================

import { monatsSchluessel } from "./abrechnung";

/** Woher eine erwartete Einnahme kommt. */
export type PrognoseQuelle = "lektion" | "rate" | "extern";

export type ErwarteteEinnahme = {
  /**
   * Wann die Forderung entsteht: Lektionsdatum bzw. Fälligkeit der Rate.
   *
   * Bewusst ein anderes Datum als in der Abrechnung, die nach
   * Zahlungseingang zählt. Eine Lektion Ende August, im September bezahlt,
   * steht hier im August und dort im September — beides richtig, nur mit
   * verschiedener Frage dahinter.
   */
  datum: string;
  betrag: number;
  quelle: PrognoseQuelle;
  bezeichnung: string;
};

export type Monatsprognose = {
  monat: string;
  /** Belegt: Zahlung eingegangen. */
  bezahlt: number;
  /** Rechnung gestellt, noch offen. */
  gestellt: number;
  /** Noch nicht fakturiert, aber angelegt. */
  erwartet: number;
  /** Alles zusammen — was der Monat voraussichtlich bringt. */
  total: number;
  /** Die einzelnen erwarteten Posten, für die Aufklappliste. */
  posten: ErwarteteEinnahme[];
};

/** Auf Rappen runden, sonst 205.00000000000003. */
function rappen(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Was eine einzelne Lektion an noch offener Forderung erzeugt.
 *
 * Das Herzstück der Prognose. `null` als Paket heisst extern: Dort zahlt
 * die Plattform pro Lektion, der Betrag kommt vom Profil.
 */
export function erwarteterBetragProLektion(paket: {
  billing_mode?: string | null;
  price_per_lesson?: number | string | null;
} | null): number {
  if (!paket) return 0;
  if (paket.billing_mode !== "pro_lektion") return 0;
  const preis = Number(paket.price_per_lesson ?? 0);
  return Number.isFinite(preis) && preis > 0 ? preis : 0;
}

export function bauePrognose(params: {
  monat: string;
  /** Bereits bezahlte Beträge des Monats (nach Zahlungsdatum). */
  bezahlt: number;
  /** Gestellte, noch offene Rechnungen (nach Fälligkeit bzw. Rechnungsdatum). */
  gestellt: number;
  /** Noch nicht fakturierte Posten. */
  erwartet: ErwarteteEinnahme[];
}): Monatsprognose {
  // Nur Posten des gefragten Monats. Die Aufrufer laden grosszügig, damit
  // Zeitzonen an den Monatsgrenzen nichts abschneiden.
  const posten = params.erwartet.filter(
    (e) => monatsSchluessel(e.datum) === params.monat
  );

  const erwartet = rappen(posten.reduce((s, e) => s + e.betrag, 0));
  const bezahlt = rappen(params.bezahlt);
  const gestellt = rappen(params.gestellt);

  return {
    monat: params.monat,
    bezahlt,
    gestellt,
    erwartet,
    total: rappen(bezahlt + gestellt + erwartet),
    posten: [...posten].sort((a, b) => a.datum.localeCompare(b.datum)),
  };
}
