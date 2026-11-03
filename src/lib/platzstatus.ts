// ============================================================
// Wie viele feste Plätze sind noch frei?
//
// David, 3. November 2026: Er ist fast ausgebucht und möchte das auf der
// Webseite zeigen, aber ehrlich: kein fester Text „fast ausgebucht“,
// sondern eine Zahl, die aus seinen Zeitfenstern gerechnet wird. Ein
// Knappheitshinweis, der nicht stimmt, wäre unlautere Werbung.
//
// ── Was ein „Platz“ ist ───────────────────────────────────
//
// Ein fester Termin alle zwei Wochen, also ein Wochentag, eine Uhrzeit und
// gerade oder ungerade Wochen. Wer wöchentlich kommt, belegt zwei davon.
// So zählt die Zahl, wie viele Schüler mit zweiwöchentlichem Rhythmus noch
// Platz hätten, und das ist die kleinste Einheit, die David vergibt.
//
// ── Warum nicht einfach die Angebote zählen ─────────────────
//
// Die Fixplatzsuche liefert jede mögliche Startzeit im 5-Minuten-Raster.
// 16:30, 16:35 und 16:40 sind dort drei Angebote, aber nur ein Platz: Wer
// 16:30 nimmt, macht die anderen beiden unmöglich. Darum wird pro Tag und
// Wochenrhythmus von vorne aufgefüllt (früheste freie Zeit, dann die
// nächste, die danach noch passt) und gezählt, wie viele hineinpassen.
// ============================================================

export type PlatzKandidat = {
  weekday: number;
  /** "HH:MM" */
  time: string;
  parity: 0 | 1 | null;
};

function minuten(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Wie viele Lektionen sich aus den möglichen Startzeiten tatsächlich
 * vergeben lassen, ohne dass sie sich überschneiden.
 *
 * `abstandMin` ist Lektion plus Pause: Die nächste Lektion darf frühestens
 * so viele Minuten nach dem Beginn der vorigen anfangen.
 */
export function zaehlePlaetze(
  kandidaten: PlatzKandidat[],
  abstandMin: number
): number {
  const gruppen = new Map<string, number[]>();
  for (const k of kandidaten) {
    const schluessel = `${k.weekday}|${k.parity ?? "w"}`;
    const liste = gruppen.get(schluessel) ?? [];
    liste.push(minuten(k.time));
    gruppen.set(schluessel, liste);
  }

  let plaetze = 0;
  for (const zeiten of gruppen.values()) {
    zeiten.sort((a, b) => a - b);
    let frei = -Infinity;
    for (const z of zeiten) {
      if (z >= frei) {
        plaetze += 1;
        frei = z + abstandMin;
      }
    }
  }
  return plaetze;
}

/** Ab wie vielen freien Plätzen kein Hinweis mehr nötig ist. */
export const WENIGE_PLAETZE = 4;

export type Platzstatus = {
  freiePlaetze: number;
  wartende: number;
  stufe: "frei" | "wenige" | "ausgebucht";
};

export function platzstufe(freiePlaetze: number): Platzstatus["stufe"] {
  if (freiePlaetze <= 0) return "ausgebucht";
  if (freiePlaetze <= WENIGE_PLAETZE) return "wenige";
  return "frei";
}

/** Der Text im Hinweis. `null` = kein Hinweis. */
export function platzText(status: Platzstatus): string | null {
  if (status.stufe === "ausgebucht") return "Zurzeit ausgebucht, die Warteliste ist offen";
  if (status.stufe === "wenige") {
    return status.freiePlaetze === 1
      ? "Nur noch 1 freier Platz"
      : `Nur noch ${status.freiePlaetze} freie Plätze`;
  }
  return null;
}

/** Zusatz zur Warteliste, nur wenn jemand wartet. */
export function wartendeText(wartende: number): string | null {
  if (wartende <= 0) return null;
  return wartende === 1
    ? "1 Person auf der Warteliste"
    : `${wartende} Personen auf der Warteliste`;
}
