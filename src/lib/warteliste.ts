// ============================================================
// Warteliste: reine Regeln, ohne Datenbank
//
// David, 3. November 2026: Ist kein fester Platz mehr frei, meldet man sich
// auf der Webseite auf die Warteliste an. David kann auch selbst eintragen
// und einen frei gewordenen Platz per Mail anbieten, mit einer Frist.
// Sagt jemand zu, legt David die Person als Schüler an.
// ============================================================

export type WunschRhythmus = "woechentlich" | "zweiwoechentlich" | "egal";

export type WartelistenStatus =
  | "wartend"
  | "angeboten"
  | "zugesagt"
  | "abgelehnt"
  | "entfernt";

export const STATUS_LABEL: Record<WartelistenStatus, string> = {
  wartend: "Wartet",
  angeboten: "Platz angeboten",
  zugesagt: "Zugesagt",
  abgelehnt: "Abgesagt",
  entfernt: "Entfernt",
};

export const RHYTHMUS_LABEL: Record<WunschRhythmus, string> = {
  woechentlich: "Jede Woche",
  zweiwoechentlich: "Alle zwei Wochen",
  egal: "Egal",
};

export const TAG_LABEL: Record<number, string> = {
  1: "Mo",
  2: "Di",
  3: "Mi",
  4: "Do",
  5: "Fr",
};

/** Vorgabe für die Antwortfrist eines Angebots, in Tagen. */
export const ANGEBOT_FRIST_TAGE = 3;

export type Anmeldung = {
  vorname: string;
  nachname: string;
  email: string;
  telefon: string | null;
  nachricht: string | null;
  wunsch_rhythmus: WunschRhythmus;
  wunsch_tage: number[];
  wunsch_zeiten: string | null;
};

type Eingabe = { get(name: string): FormDataEntryValue | null; getAll(name: string): FormDataEntryValue[] };

function text(fd: Eingabe, name: string, max = 2000): string | null {
  const v = fd.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

/**
 * Prüft eine Anmeldung aus dem Formular.
 *
 * Im Unterschied zur Probelektion ist die Nachricht hier freiwillig: Wer
 * auf die Warteliste geht, hat Tage und Rhythmus schon angegeben, und
 * David schreibt ohnehin erst, wenn ein Platz frei wird.
 */
export function pruefeAnmeldung(
  fd: Eingabe
): { ok: true; daten: Anmeldung } | { ok: false; fehler: string } {
  const vorname = text(fd, "vorname", 100);
  const nachname = text(fd, "nachname", 100);
  const email = text(fd, "email", 200)?.toLowerCase() ?? null;

  if (!vorname || !nachname || !email) {
    return { ok: false, fehler: "Bitte Vor- und Nachname sowie E-Mail angeben." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, fehler: "Ungültige E-Mail-Adresse." };
  }

  const r = text(fd, "wunsch_rhythmus");
  const wunsch_rhythmus: WunschRhythmus =
    r === "woechentlich" || r === "zweiwoechentlich" ? r : "egal";

  const wunsch_tage = [
    ...new Set(
      fd
        .getAll("wunsch_tage")
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5)
    ),
  ].sort();

  return {
    ok: true,
    daten: {
      vorname,
      nachname,
      email,
      telefon: text(fd, "telefon", 50),
      nachricht: text(fd, "nachricht"),
      wunsch_rhythmus,
      wunsch_tage,
      wunsch_zeiten: text(fd, "wunsch_zeiten", 300),
    },
  };
}

/** Bis wann jemand auf ein Angebot antworten kann: Ende des letzten Tages. */
export function angebotFrist(jetzt: Date, tage: number): Date {
  const t = Math.min(Math.max(Math.round(tage), 1), 14);
  return new Date(jetzt.getTime() + t * 86400000);
}

export type AngebotZustand = "offen" | "abgelaufen" | "beantwortet" | "ungueltig";

/** Ob ein Angebot noch beantwortet werden kann. */
export function angebotZustand(
  eintrag: { status: string; angebot_frist: string | null } | null,
  jetzt: Date
): AngebotZustand {
  if (!eintrag) return "ungueltig";
  if (eintrag.status === "zugesagt" || eintrag.status === "abgelehnt") return "beantwortet";
  if (eintrag.status !== "angeboten") return "ungueltig";
  if (eintrag.angebot_frist && new Date(eintrag.angebot_frist).getTime() < jetzt.getTime()) {
    return "abgelaufen";
  }
  return "offen";
}

/** Eine zufällige, nicht erratbare Kennung für den Link im Angebotsmail. */
export function neuesToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
