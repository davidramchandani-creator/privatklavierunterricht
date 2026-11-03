// ============================================================
// Auswertung: Wirken die neuen Preise?
//
// David, 3. November 2026: Er hat die Preise für neue Schüler auf 100 / 85 /
// 80 erhöht und will mitverfolgen, ob das trägt. Diese Datei rechnet
// monatsweise aus, wie viele Anfragen kommen, wie viele sich auf die
// Warteliste setzen, wie viele als Schüler dazukommen und zu welchem Preis.
//
// Reine Rechnung ohne Datenbank, damit sie sich testen lässt.
//
// ── Wie man die Zahlen lesen muss ──────────────────────────
//
// Es sind wenige Personen pro Monat. Drei Anfragen mehr oder weniger sind
// Zufall, kein Trend. Die Seite sagt das ausdrücklich und zeigt die
// Umwandlungsquote erst, wenn mindestens 5 Anfragen zusammenkommen.
// ============================================================

import { NEUPREISE } from "./neupreise";

/** Ab diesem Tag gelten die neuen Preise für neue Schüler. */
export const PREISSTART = "2026-11-03";

/** Davor galten für neue Schüler 85 / 70 / 65. */
export const ALTPREISE = { einzel: 85, semester: 70, jahr: 65 } as const;

/** Ab wie vielen Anfragen eine Quote gezeigt wird. */
export const MINDEST_ANFRAGEN_FUER_QUOTE = 5;

/** Wie lange nach einer Anfrage ein neuer Schüler noch als Folge zählt. */
export const FOLGE_TAGE = 90;

export type AnfrageZeile = { erstellt_am: string; email: string };
export type WartelisteZeile = { erstellt_am: string; quelle: "webseite" | "admin" };
export type SchuelerZeile = {
  erstellt_am: string;
  email: string | null;
  /** Semesterabo-Preis pro Lektion im Profil. */
  price_halbjahr: number | string | null;
};

export type Monatszeile = {
  /** "2026-11" */
  monat: string;
  anfragen: number;
  warteliste: number;
  neueSchueler: number;
  /** Neue Schüler, die Listenpreis zahlen. */
  zuListenpreis: number;
  /** Neue Schüler mit einem Preis unter dem Listenpreis. */
  guenstiger: number;
  /** Neue Schüler, die vorher angefragt hatten (gleiche Mail, höchstens 90 Tage). */
  ausAnfrage: number;
};

export type Auswertung = {
  monate: Monatszeile[];
  seitPreisstart: {
    anfragen: number;
    warteliste: number;
    neueSchueler: number;
    guenstiger: number;
    /** 0 bis 1, `null` solange zu wenige Anfragen vorliegen. */
    quote: number | null;
  };
  vorPreisstart: {
    /** Durchschnitt pro Monat in den Monaten vor der Umstellung. */
    anfragenProMonat: number | null;
    monate: number;
  };
};

/** "2026-11" aus einem ISO-Zeitpunkt, in Zürcher Zeit. */
export function monatVon(iso: string): string {
  const d = new Date(iso);
  const teile = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
  }).format(d);
  return teile.slice(0, 7);
}

function tagVon(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Der Listenpreis für das Semesterabo, der an diesem Tag für Neue galt. */
export function listenpreisSemester(tag: string): number {
  return tag >= PREISSTART ? NEUPREISE.semester : ALTPREISE.semester;
}

function monateZurueck(bis: string, anzahl: number): string[] {
  const [j, m] = bis.split("-").map(Number);
  const liste: string[] = [];
  for (let i = anzahl - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(j, m - 1 - i, 1));
    liste.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return liste;
}

export function baueAuswertung(
  daten: {
    anfragen: AnfrageZeile[];
    warteliste: WartelisteZeile[];
    schueler: SchuelerZeile[];
  },
  jetzt: Date,
  anzahlMonate = 12
): Auswertung {
  const aktuell = monatVon(jetzt.toISOString());
  const schluessel = monateZurueck(aktuell, anzahlMonate);
  const zeilen = new Map<string, Monatszeile>(
    schluessel.map((monat) => [
      monat,
      {
        monat,
        anfragen: 0,
        warteliste: 0,
        neueSchueler: 0,
        zuListenpreis: 0,
        guenstiger: 0,
        ausAnfrage: 0,
      },
    ])
  );

  // Anfragen je Mail, damit ein neuer Schüler seiner Anfrage zugeordnet
  // werden kann.
  const anfragenJeMail = new Map<string, number[]>();
  for (const a of daten.anfragen) {
    const mail = a.email.trim().toLowerCase();
    const liste = anfragenJeMail.get(mail) ?? [];
    liste.push(new Date(a.erstellt_am).getTime());
    anfragenJeMail.set(mail, liste);
    const z = zeilen.get(monatVon(a.erstellt_am));
    if (z) z.anfragen += 1;
  }

  for (const w of daten.warteliste) {
    const z = zeilen.get(monatVon(w.erstellt_am));
    if (z) z.warteliste += 1;
  }

  let seitSchueler = 0;
  let seitGuenstiger = 0;
  let seitAusAnfrage = 0;

  for (const s of daten.schueler) {
    const z = zeilen.get(monatVon(s.erstellt_am));
    if (!z) continue;
    z.neueSchueler += 1;

    const tag = tagVon(s.erstellt_am);
    const liste = listenpreisSemester(tag);
    const preis = Number(s.price_halbjahr ?? liste);
    const guenstiger = preis < liste;
    if (guenstiger) z.guenstiger += 1;
    else z.zuListenpreis += 1;

    const angelegt = new Date(s.erstellt_am).getTime();
    const fruehere = anfragenJeMail.get((s.email ?? "").trim().toLowerCase()) ?? [];
    const ausAnfrage = fruehere.some(
      (t) => t <= angelegt && angelegt - t <= FOLGE_TAGE * 86400000
    );
    if (ausAnfrage) z.ausAnfrage += 1;

    if (tag >= PREISSTART) {
      seitSchueler += 1;
      if (guenstiger) seitGuenstiger += 1;
      if (ausAnfrage) seitAusAnfrage += 1;
    }
  }

  const seitAnfragen = daten.anfragen.filter((a) => tagVon(a.erstellt_am) >= PREISSTART).length;
  const seitWarteliste = daten.warteliste.filter((w) => tagVon(w.erstellt_am) >= PREISSTART).length;

  const monate = [...zeilen.values()];

  // Der Schnitt vor der Umstellung: nur ganze Monate davor, und nur ab dem
  // ersten Monat mit einer Anfrage. Vorher gab es die Anfrageseite noch gar
  // nicht, und Nullen würden den Schnitt drücken.
  const preisMonat = PREISSTART.slice(0, 7);
  const davor = monate.filter((m) => m.monat < preisMonat);
  const ersterMitAnfrage = davor.findIndex((m) => m.anfragen > 0);
  const davorAb = ersterMitAnfrage === -1 ? [] : davor.slice(ersterMitAnfrage);

  return {
    monate,
    seitPreisstart: {
      anfragen: seitAnfragen,
      warteliste: seitWarteliste,
      neueSchueler: seitSchueler,
      guenstiger: seitGuenstiger,
      quote:
        seitAnfragen >= MINDEST_ANFRAGEN_FUER_QUOTE
          ? Math.min(seitAusAnfrage / seitAnfragen, 1)
          : null,
    },
    vorPreisstart: {
      anfragenProMonat:
        davorAb.length > 0
          ? davorAb.reduce((s, m) => s + m.anfragen, 0) / davorAb.length
          : null,
      monate: davorAb.length,
    },
  };
}
