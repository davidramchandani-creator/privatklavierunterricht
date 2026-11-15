// ============================================================
// Feste Gruppen (zu zweit oder zu dritt): reine Logik ohne Datenbank
//
// Die Zahlen stehen in lib/gruppenunterricht.ts. Hier steht, wie sie im
// Admin und bei Absagen angewendet werden.
// ============================================================

import type { AboVariante } from "./abo";
import { GRUPPENUNTERRICHT, type Gruppengroesse } from "./gruppenunterricht";

/** Lektionspreis pro Person. Das Semesterabo heisst intern "halbjahr". */
export function gruppenLektionspreis(groesse: Gruppengroesse, variante: AboVariante): number {
  const g = GRUPPENUNTERRICHT[groesse];
  return variante === "jahr" ? g.jahr : g.semester;
}

export function gruppenMinuten(groesse: Gruppengroesse): number {
  return GRUPPENUNTERRICHT[groesse].minuten;
}

/** Prüft die gewählten Mitglieder. Gibt die Grösse oder eine Fehlermeldung zurück. */
export function pruefeMitglieder(ids: string[]): Gruppengroesse | { error: string } {
  const sauber = ids.map((i) => i.trim()).filter(Boolean);
  if (new Set(sauber).size !== sauber.length) {
    return { error: "Ein Schüler ist doppelt ausgewählt." };
  }
  if (sauber.length !== 2 && sauber.length !== 3) {
    return { error: "Eine Gruppe hat zwei oder drei Schüler." };
  }
  return sauber.length as Gruppengroesse;
}

/** Vorschlag für den Gruppennamen aus den Vornamen: „Anna und Ben“. */
export function gruppenNameAus(vornamen: string[]): string {
  const n = vornamen.map((v) => v.trim()).filter(Boolean);
  if (n.length === 0) return "Gruppe";
  if (n.length === 1) return n[0];
  return `${n.slice(0, -1).join(", ")} und ${n[n.length - 1]}`;
}

/**
 * Welcher Termin einer Gruppenlektion das Google-Event trägt.
 *
 * Jedes Mitglied hat einen eigenen Termin, im Kalender soll die Lektion aber
 * nur einmal stehen. Der gebuchte Termin mit der kleinsten id trägt es. Sagt
 * genau dieses Mitglied ab, rückt das nächste nach.
 */
export function leitTermin<T extends { id: string; status: string }>(termine: T[]): T | null {
  const gebucht = termine.filter((t) => t.status === "booked");
  if (gebucht.length === 0) return null;
  return [...gebucht].sort((a, b) => (a.id < b.id ? -1 : 1))[0];
}

/**
 * Was bei einer Absage in einer Gruppe passiert.
 *
 * Schüler sagt ab: Die Lektion findet für die anderen statt, und alle
 * zahlen (David, 5. November 2026). Also weder Ersatz noch Gutschrift,
 * egal wie früh die Absage kommt.
 *
 * David sagt ab: Dafür gibt es noch keine Regel für Gruppen. Die Lektion
 * bleibt als offen erfasst, aber nichts wird automatisch gebucht. Eine
 * Ersatzlektion allein für eine Person wäre falsch (45 Minuten, anderer
 * Preis), und die ganze Gruppe neu einzuplanen entscheidet David.
 */
export function gruppenBehandlung(verursacher: "schueler" | "admin"): {
  lektionErhalten: boolean;
  ersatzSuchen: false;
  automatischNachholen: false;
} {
  return {
    lektionErhalten: verursacher === "admin",
    ersatzSuchen: false,
    automatischNachholen: false,
  };
}
