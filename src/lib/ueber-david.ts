// ============================================================
// Alter und Klaviererfahrung, immer aktuell
//
// Beides stand von Hand an mehreren Stellen („21 Jahre", „16 Jahre") und war
// jedes Jahr irgendwo veraltet. Jetzt steht hier einmal das Geburtsdatum und
// das Jahr, in dem David mit Klavier anfing, und die Seiten rechnen daraus.
//
// Geburtsdatum: 15. September 2004. Es steht nur hier im Code, nirgends
// sichtbar auf der Seite.
// Klavierbeginn: 2009. Davids eigene Angabe, nur das Jahr ist sicher. Darum
// zählt die Erfahrung in vollen Kalenderjahren seit 2009 und springt am
// 1. Januar, nicht am Jahrestag.
// ============================================================

export const GEBURTSDATUM = { jahr: 2004, monat: 9, tag: 15 } as const;
export const KLAVIER_SEIT_JAHR = 2009;

/** Heutiges Datum in der Schweiz, damit der Sprung nicht um 1 oder 2 Uhr nachts kippt. */
function heuteInZuerich(jetzt: Date): { jahr: number; monat: number; tag: number } {
  const teile = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(jetzt);
  const [jahr, monat, tag] = teile.split("-").map(Number);
  return { jahr, monat, tag };
}

/** Davids Alter in vollen Jahren. */
export function davidsAlter(jetzt: Date = new Date()): number {
  const h = heuteInZuerich(jetzt);
  let alter = h.jahr - GEBURTSDATUM.jahr;
  const hatteGeburtstag =
    h.monat > GEBURTSDATUM.monat ||
    (h.monat === GEBURTSDATUM.monat && h.tag >= GEBURTSDATUM.tag);
  if (!hatteGeburtstag) alter -= 1;
  return alter;
}

/** Jahre Klaviererfahrung, in Kalenderjahren seit dem Beginn. */
export function jahreKlaviererfahrung(jetzt: Date = new Date()): number {
  return heuteInZuerich(jetzt).jahr - KLAVIER_SEIT_JAHR;
}
