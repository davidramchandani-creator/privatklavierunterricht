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
/** Beginn des eigenen Unterrichts: Anfang 2024 (Lebenslauf auf /ueber-mich). */
export const UNTERRICHT_SEIT = { jahr: 2024, monat: 1 } as const;

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

const ZAHLWORT = ["null", "einem", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];

function zahlwort(n: number): string {
  return ZAHLWORT[n] ?? String(n);
}

/**
 * Unterrichtserfahrung als Satzteil, passend zu „In meinen … Unterrichtserfahrung".
 *
 * Gezählt in Monaten seit Januar 2024, dann ehrlich gerundet: ab neun
 * Monaten über einem vollen Jahr heisst es „knapp drei", ab drei Monaten
 * „über zwei", sonst die volle Zahl. So steht nie mehr da, als stimmt.
 */
export function unterrichtserfahrungText(jetzt: Date = new Date()): string {
  const h = heuteInZuerich(jetzt);
  const monate = (h.jahr - UNTERRICHT_SEIT.jahr) * 12 + (h.monat - UNTERRICHT_SEIT.monat);
  const jahre = Math.floor(monate / 12);
  const rest = monate % 12;
  if (jahre < 1) return rest >= 9 ? "knapp einem Jahr" : `${zahlwort(Math.max(rest, 1))} Monaten`;
  if (rest >= 9) return `knapp ${zahlwort(jahre + 1)} Jahren`;
  if (rest >= 3) return `über ${zahlwort(jahre)} ${jahre === 1 ? "Jahr" : "Jahren"}`;
  return `${zahlwort(jahre)} ${jahre === 1 ? "Jahr" : "Jahren"}`;
}
