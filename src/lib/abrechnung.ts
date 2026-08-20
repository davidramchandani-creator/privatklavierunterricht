// ============================================================
// Monatsabrechnung: was reinkam, was rausging
//
// Für die Steuererklärung. Gezählt wird nach **Zahlungseingang**, nicht
// nach Lektionsdatum — das ist die übliche Einnahmen-Ausgaben-Rechnung für
// Selbstständige und entspricht dem, was auf dem Konto war. Eine im
// Dezember gehaltene, im Januar bezahlte Lektion gehört ins neue Jahr.
//
// Reine Funktionen, kein DB-Zugriff. Der liegt in abrechnung-server.ts.
// ============================================================

export const AUSGABE_KATEGORIEN = [
  "fahrt",
  "verpflegung",
  "material",
  "weiterbildung",
  "sonstiges",
] as const;

export type AusgabeKategorie = (typeof AUSGABE_KATEGORIEN)[number];

export const KATEGORIE_LABELS: Record<AusgabeKategorie, string> = {
  fahrt: "Fahrtkosten",
  verpflegung: "Verpflegung",
  material: "Material & Noten",
  weiterbildung: "Weiterbildung & Software",
  sonstiges: "Sonstiges",
};

export type Ausgabe = {
  id: string;
  datum: string;
  kategorie: AusgabeKategorie;
  betrag: number;
  notiz: string | null;
};

export type Einnahme = {
  /** Zahlungsdatum, nicht Lektionsdatum. */
  datum: string;
  betrag: number;
  quelle: "rechnung" | "extern";
  bezeichnung: string;
};

export type Monatsabrechnung = {
  /** YYYY-MM. */
  monat: string;
  einnahmenSystem: number;
  /**
   * Was über andere Plattformen läuft. Aus gehaltenen Lektionen mal
   * hinterlegtem Ertrag **hochgerechnet**, nicht aus echten Zahlungen —
   * diese Beträge kennt nur die Plattform. Getrennt ausgewiesen, damit
   * niemand eine Schätzung für eine Buchung hält.
   */
  einnahmenExtern: number;
  einnahmenTotal: number;
  ausgabenNachKategorie: Record<AusgabeKategorie, number>;
  ausgabenTotal: number;
  ergebnis: number;
  einnahmen: Einnahme[];
  ausgaben: Ausgabe[];
};

/** YYYY-MM eines Datums in Zürcher Ortszeit. */
export function monatsSchluessel(iso: string | Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(iso));
}

/** "2026-08" → "August 2026". */
export function monatsName(schluessel: string): string {
  const [j, m] = schluessel.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, 1)).toLocaleDateString("de-CH", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

/** Auf Rappen runden. Summen aus Fliesskomma sonst 205.00000000000003. */
function rappen(n: number): number {
  return Math.round(n * 100) / 100;
}

export function baueAbrechnung(params: {
  monat: string;
  einnahmen: Einnahme[];
  ausgaben: Ausgabe[];
}): Monatsabrechnung {
  const einnahmen = params.einnahmen.filter(
    (e) => monatsSchluessel(e.datum) === params.monat
  );
  const ausgaben = params.ausgaben.filter(
    (a) => monatsSchluessel(a.datum) === params.monat
  );

  const einnahmenSystem = rappen(
    einnahmen
      .filter((e) => e.quelle === "rechnung")
      .reduce((s, e) => s + e.betrag, 0)
  );
  const einnahmenExtern = rappen(
    einnahmen
      .filter((e) => e.quelle === "extern")
      .reduce((s, e) => s + e.betrag, 0)
  );

  const ausgabenNachKategorie = Object.fromEntries(
    AUSGABE_KATEGORIEN.map((k) => [
      k,
      rappen(
        ausgaben.filter((a) => a.kategorie === k).reduce((s, a) => s + a.betrag, 0)
      ),
    ])
  ) as Record<AusgabeKategorie, number>;

  const ausgabenTotal = rappen(ausgaben.reduce((s, a) => s + a.betrag, 0));
  const einnahmenTotal = rappen(einnahmenSystem + einnahmenExtern);

  return {
    monat: params.monat,
    einnahmenSystem,
    einnahmenExtern,
    einnahmenTotal,
    ausgabenNachKategorie,
    ausgabenTotal,
    ergebnis: rappen(einnahmenTotal - ausgabenTotal),
    einnahmen: [...einnahmen].sort((a, b) => a.datum.localeCompare(b.datum)),
    ausgaben: [...ausgaben].sort((a, b) => a.datum.localeCompare(b.datum)),
  };
}

/**
 * Ab wann nach den Ausgaben gefragt wird: fünf Tage vor Monatsende.
 *
 * Nicht am Monatsletzten, weil die Erinnerung dann in derselben Woche
 * ankommt, in der man sie schon nicht mehr braucht — und nicht früher, weil
 * sonst die letzten Tage fehlen und man zweimal ran muss.
 */
export const ERINNERUNG_TAGE_VOR_MONATSENDE = 5;

/** Letzter Tag des Monats, in dem `datum` liegt (Zürcher Kalender). */
export function letzterTagDesMonats(datum: Date): number {
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
  }).format(datum);
  const [j, m] = s.split("-").map(Number);
  return new Date(Date.UTC(j, m, 0)).getUTCDate();
}

/** Tag des Monats in Zürcher Ortszeit. */
export function tagImMonat(datum: Date): number {
  return Number(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Zurich",
      day: "2-digit",
    }).format(datum)
  );
}

/** Ist heute der Tag, an dem nach den Ausgaben gefragt wird? */
export function istErinnerungsTag(jetzt: Date): boolean {
  const letzter = letzterTagDesMonats(jetzt);
  const heute = tagImMonat(jetzt);
  return heute >= letzter - ERINNERUNG_TAGE_VOR_MONATSENDE + 1;
}

/** Eine Zeile CSV, mit Anführungszeichen wo nötig. */
function csvFeld(wert: string | number): string {
  const s = String(wert);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Abrechnung als CSV für die Steuererklärung oder den Treuhänder.
 *
 * Semikolon als Trennzeichen: Excel in der Schweiz erwartet das, mit Komma
 * landet alles in einer Spalte. BOM voran, sonst zeigt Excel Umlaute falsch.
 */
export function alsCsv(abrechnungen: Monatsabrechnung[]): string {
  const zeilen: string[] = [];
  zeilen.push(
    [
      "Monat",
      "Einnahmen System",
      "Einnahmen extern",
      "Einnahmen total",
      ...AUSGABE_KATEGORIEN.map((k) => KATEGORIE_LABELS[k]),
      "Ausgaben total",
      "Ergebnis",
    ]
      .map(csvFeld)
      .join(";")
  );

  for (const a of abrechnungen) {
    zeilen.push(
      [
        monatsName(a.monat),
        a.einnahmenSystem.toFixed(2),
        a.einnahmenExtern.toFixed(2),
        a.einnahmenTotal.toFixed(2),
        ...AUSGABE_KATEGORIEN.map((k) => a.ausgabenNachKategorie[k].toFixed(2)),
        a.ausgabenTotal.toFixed(2),
        a.ergebnis.toFixed(2),
      ]
        .map(csvFeld)
        .join(";")
    );
  }

  // Jahressumme: Wer die Datei dem Treuhänder gibt, will die Zahl unten
  // stehen haben, nicht selbst addieren.
  if (abrechnungen.length > 1) {
    const summe = (f: (a: Monatsabrechnung) => number) =>
      rappen(abrechnungen.reduce((s, a) => s + f(a), 0)).toFixed(2);
    zeilen.push(
      [
        "Total",
        summe((a) => a.einnahmenSystem),
        summe((a) => a.einnahmenExtern),
        summe((a) => a.einnahmenTotal),
        ...AUSGABE_KATEGORIEN.map((k) =>
          summe((a) => a.ausgabenNachKategorie[k])
        ),
        summe((a) => a.ausgabenTotal),
        summe((a) => a.ergebnis),
      ]
        .map(csvFeld)
        .join(";")
    );
  }

  return "﻿" + zeilen.join("\n");
}
