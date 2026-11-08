// ============================================================
// Bewerbung als Lehrperson: Angebot, Fragen, Prüfung, Stufen, Mailvorlagen
//
// David, 8. November 2026. Der Lohn steht offen auf der Seite (CHF 50 pro
// Lektion inklusive Ferienentschädigung), damit nur ernsthafte Bewerbungen
// kommen. Voraussetzungen: gute Spielerfahrung (kein Diplom nötig),
// Unterrichtserfahrung erwünscht, Studium Musik oder PH willkommen, mobil
// in der Region Winterthur und Zürich.
// ============================================================

export const ANGEBOT = {
  lohn: 50,
  lektionMinuten: 45,
  start: "2027-02-22",
  startText: "Februar 2027",
  region: "Winterthur und Zürich",
} as const;

export const TAGE = [
  { key: "mo", label: "Mo" },
  { key: "di", label: "Di" },
  { key: "mi", label: "Mi" },
  { key: "do", label: "Do" },
  { key: "fr", label: "Fr" },
  { key: "sa", label: "Sa" },
] as const;

export const ZEITFENSTER = [
  { key: "nachmittag", label: "13 bis 16 Uhr" },
  { key: "spaet", label: "16 bis 18 Uhr" },
  { key: "abend", label: "18 bis 20 Uhr" },
] as const;

export const STILE = ["Pop", "Klassik", "Jazz", "Filmmusik", "Singer-Songwriter", "Begleiten", "Improvisation", "Rock/Blues"];

export const ALTERSGRUPPEN = [
  { key: "kinder", label: "Kinder" },
  { key: "jugendliche", label: "Jugendliche" },
  { key: "erwachsene", label: "Erwachsene" },
] as const;

export const ORTE = [
  { key: "hausbesuch", label: "Hausbesuche bei den Schülern" },
  { key: "zuhause", label: "Bei mir zu Hause (mit Klavier oder E-Piano)" },
] as const;

export const MOBILITAET = [
  { key: "oev", label: "ÖV" },
  { key: "velo", label: "Velo" },
  { key: "auto", label: "Auto" },
] as const;

export const PENSUM = ["1 bis 3", "4 bis 6", "7 bis 10", "mehr als 10"];

export type BewerbungStatus = "neu" | "gespraech" | "probelektion" | "zusage" | "absage" | "zurueckgezogen";

export const STATUS_LABEL: Record<BewerbungStatus, string> = {
  neu: "Neu",
  gespraech: "Gespräch",
  probelektion: "Probelektion",
  zusage: "Zusage",
  absage: "Absage",
  zurueckgezogen: "Zurückgezogen",
};

export type Bewerbung = {
  vorname: string;
  nachname: string;
  email: string;
  telefon: string | null;
  wohnort: string | null;
  mindestens_20: boolean | null;
  spielt_seit: number | null;
  stile: string[];
  lieblingssong: string | null;
  unterrichtserfahrung: "keine" | "etwas" | "viel" | null;
  unterrichtserfahrung_text: string | null;
  ausbildung: string | null;
  altersgruppen: string[];
  akkord_erklaerung: string | null;
  wichtig_im_unterricht: string | null;
  verfuegbarkeit: Record<string, string[]>;
  unterrichtsorte: string[];
  mobilitaet: string[];
  lektionen_pro_woche: string | null;
  start_ab: string | null;
  leitbild_passt: boolean;
};

const txt = (v: unknown, max = 1000): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
};
const liste = (v: unknown, erlaubt: readonly string[]): string[] =>
  Array.isArray(v) ? [...new Set(v.map(String).filter((x) => erlaubt.includes(x)))] : [];

/** Prüft die Bewerbung (kommt als JSON aus dem Formular in Schritten). */
export function pruefeBewerbung(
  roh: Record<string, unknown>,
  jetzt = new Date()
): { ok: true; daten: Bewerbung } | { ok: false; fehler: string } {
  const vorname = txt(roh.vorname, 100);
  const nachname = txt(roh.nachname, 100);
  const email = txt(roh.email, 200)?.toLowerCase() ?? null;
  if (!vorname || !nachname) return { ok: false, fehler: "Bitte Vor- und Nachname angeben." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, fehler: "Bitte eine gültige E-Mail angeben." };
  if (roh.datenschutz !== true) return { ok: false, fehler: "Bitte bestätige, dass ich deine Angaben für die Bewerbung speichern darf." };

  const jahr = Number(roh.spielt_seit);
  const spielt_seit = Number.isInteger(jahr) && jahr >= 1950 && jahr <= jetzt.getFullYear() ? jahr : null;

  const erfahrung = roh.unterrichtserfahrung;
  const verfuegbarkeit: Record<string, string[]> = {};
  if (roh.verfuegbarkeit && typeof roh.verfuegbarkeit === "object") {
    for (const t of TAGE) {
      const fenster = liste((roh.verfuegbarkeit as Record<string, unknown>)[t.key], ZEITFENSTER.map((z) => z.key));
      if (fenster.length) verfuegbarkeit[t.key] = fenster;
    }
  }
  if (Object.keys(verfuegbarkeit).length === 0) {
    return { ok: false, fehler: "Bitte kreuz mindestens ein Zeitfenster an." };
  }
  const start = txt(roh.start_ab, 10);

  return {
    ok: true,
    daten: {
      vorname,
      nachname,
      email,
      telefon: txt(roh.telefon, 50),
      wohnort: txt(roh.wohnort, 120),
      mindestens_20: roh.mindestens_20 === true ? true : roh.mindestens_20 === false ? false : null,
      spielt_seit,
      stile: liste(roh.stile, STILE),
      lieblingssong: txt(roh.lieblingssong, 200),
      unterrichtserfahrung: erfahrung === "keine" || erfahrung === "etwas" || erfahrung === "viel" ? erfahrung : null,
      unterrichtserfahrung_text: txt(roh.unterrichtserfahrung_text),
      ausbildung: txt(roh.ausbildung, 300),
      altersgruppen: liste(roh.altersgruppen, ALTERSGRUPPEN.map((a) => a.key)),
      akkord_erklaerung: txt(roh.akkord_erklaerung),
      wichtig_im_unterricht: txt(roh.wichtig_im_unterricht),
      verfuegbarkeit,
      unterrichtsorte: liste(roh.unterrichtsorte, ORTE.map((o) => o.key)),
      mobilitaet: liste(roh.mobilitaet, MOBILITAET.map((m) => m.key)),
      lektionen_pro_woche: PENSUM.includes(String(roh.lektionen_pro_woche)) ? String(roh.lektionen_pro_woche) : null,
      start_ab: start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null,
      leitbild_passt: roh.leitbild_passt === true,
    },
  };
}

/** Wie viele Zeitfenster angekreuzt sind (für die Übersicht im Admin). */
export function anzahlFenster(v: Record<string, string[]>): number {
  return Object.values(v).reduce((s, f) => s + f.length, 0);
}

/**
 * Kurze Hinweise für David, ohne Wertung der Person: Was passt zum
 * Bedarf, was fehlt. Er entscheidet selbst.
 */
export function hinweise(b: Pick<Bewerbung, "unterrichtsorte" | "mobilitaet" | "verfuegbarkeit" | "unterrichtserfahrung" | "mindestens_20" | "leitbild_passt">): { gut: string[]; offen: string[] } {
  const gut: string[] = [];
  const offen: string[] = [];
  if (b.unterrichtsorte.includes("hausbesuch")) gut.push("macht Hausbesuche");
  if (b.unterrichtsorte.includes("zuhause")) gut.push("kann zu Hause unterrichten");
  if (b.unterrichtsorte.length === 0) offen.push("kein Unterrichtsort gewählt");
  if (b.unterrichtsorte.includes("hausbesuch") && b.mobilitaet.length === 0) offen.push("Mobilität unklar");
  const n = anzahlFenster(b.verfuegbarkeit);
  if (n >= 6) gut.push(`${n} Zeitfenster pro Woche`);
  else offen.push(`nur ${n} Zeitfenster pro Woche`);
  if (b.unterrichtserfahrung === "viel") gut.push("viel Unterrichtserfahrung");
  if (b.unterrichtserfahrung === "keine") offen.push("noch keine Unterrichtserfahrung");
  if (b.mindestens_20 === false) offen.push("unter 20: Ferienentschädigung 10.64 %");
  if (b.leitbild_passt) gut.push("Beziehung vor Programm passt");
  return { gut, offen };
}

/**
 * Vorbereitete Mails pro Stufe. David kann sie vor dem Senden anpassen.
 * {vorname} wird ersetzt.
 */
export const MAILVORLAGEN: Partial<Record<BewerbungStatus, { betreff: string; text: string }>> = {
  gespraech: {
    betreff: "Deine Bewerbung: Lass uns kurz sprechen",
    text:
      "Hallo {vorname}\n\nDanke für deine Bewerbung, sie hat mir gefallen! Ich würde dich gerne kennenlernen, in einem lockeren Gespräch von etwa 20 Minuten, per Telefon oder Video.\n\nWann passt es dir in den nächsten Tagen? Schick mir zwei, drei Möglichkeiten, dann melde ich mich.\n\nLiebe Grüsse\nDavid Ramchandani",
  },
  probelektion: {
    betreff: "Nächster Schritt: eine Probelektion",
    text:
      "Hallo {vorname}\n\nDanke für das gute Gespräch! Als nächsten Schritt möchte ich gerne sehen, wie du unterrichtest. Wir machen dazu eine kurze Probelektion zusammen, du unterrichtest mich oder eine Testperson etwa 20 Minuten lang, ganz entspannt.\n\nWann hättest du Zeit? Ich melde mich dann mit Ort und Zeit.\n\nLiebe Grüsse\nDavid Ramchandani",
  },
  zusage: {
    betreff: "Willkommen im Team!",
    text:
      "Hallo {vorname}\n\nIch freue mich sehr: Ich möchte gerne mit dir zusammenarbeiten! In den nächsten Tagen schicke ich dir den Arbeitsvertrag und eine Einladung für dein Portal. Dort findest du auch unser Leitbild.\n\nBei Fragen melde dich jederzeit.\n\nLiebe Grüsse\nDavid Ramchandani",
  },
  absage: {
    betreff: "Deine Bewerbung",
    text:
      "Hallo {vorname}\n\nVielen Dank für deine Bewerbung und dein Interesse. Ich habe mich nach reiflicher Überlegung entschieden, im Moment nicht mit dir zusammenzuarbeiten. Das hat nichts mit deinem Können am Klavier zu tun, sondern damit, was ich gerade brauche.\n\nIch wünsche dir alles Gute und viel Freude mit der Musik.\n\nLiebe Grüsse\nDavid Ramchandani",
  },
};

export function vorlageFuer(status: BewerbungStatus, vorname: string): { betreff: string; text: string } | null {
  const v = MAILVORLAGEN[status];
  if (!v) return null;
  return { betreff: v.betreff, text: v.text.replaceAll("{vorname}", vorname) };
}
