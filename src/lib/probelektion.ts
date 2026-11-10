// ============================================================
// Probelektionen, die David selbst einträgt (10. November 2026)
//
// David: „es muss auch möglich sein probelektion von meiner seite an
// anzulegen damit es auch den kalender blockiert und die mail raus geht,
// mail ist aber nicht muss."
//
// Reine Logik ohne Datenbank, damit sie testbar bleibt.
// ============================================================

import { zonedToUtc } from "./booking";

/** Vorgabe für die Dauer, wie auf der Webseite beschrieben. */
export const PROBELEKTION_MINUTEN = 45;

export type ProbelektionEingabe = {
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
  /** YYYY-MM-DD */
  datum: string;
  /** HH:MM */
  zeit: string;
  minuten: number;
  notiz: string;
  mailSenden: boolean;
};

export type GeprueftProbelektion =
  | { ok: true; start: Date; ende: Date }
  | { ok: false; fehler: string };

export function pruefeProbelektion(e: ProbelektionEingabe): GeprueftProbelektion {
  if (!e.vorname.trim()) return { ok: false, fehler: "Bitte einen Vornamen angeben." };
  if (e.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email.trim())) {
    return { ok: false, fehler: "Die E-Mail-Adresse stimmt nicht." };
  }
  if (e.mailSenden && !e.email.trim()) {
    return { ok: false, fehler: "Für die Mail braucht es eine E-Mail-Adresse." };
  }
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.datum);
  const z = /^(\d{2}):(\d{2})$/.exec(e.zeit);
  if (!d || !z) return { ok: false, fehler: "Bitte Datum und Uhrzeit angeben." };
  const minuten = Math.round(e.minuten);
  if (!Number.isFinite(minuten) || minuten < 15 || minuten > 180) {
    return { ok: false, fehler: "Die Dauer muss zwischen 15 und 180 Minuten liegen." };
  }
  const start = zonedToUtc(Number(d[1]), Number(d[2]), Number(d[3]), Number(z[1]), Number(z[2]));
  if (Number.isNaN(start.getTime())) return { ok: false, fehler: "Datum oder Uhrzeit ungültig." };
  return { ok: true, start, ende: new Date(start.getTime() + minuten * 60_000) };
}

export type Belegung = { start: Date; ende: Date; was: string };

/** Was sich mit dem Zeitraum überschneidet (ohne Pause, nur echte Überlappung). */
export function ueberschneidungen(start: Date, ende: Date, belegt: Belegung[]): Belegung[] {
  return belegt.filter((b) => b.start < ende && start < b.ende);
}
