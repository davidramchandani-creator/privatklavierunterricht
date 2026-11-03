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
  /** Kurzer Zusatz zur Zahl, z. B. „ab Februar“. Nur bei eigener Zahl. */
  zusatz?: string | null;
  /** Hat David die Zahl selbst eingetragen? */
  manuell?: boolean;
  /** Was die Rechnung ergeben hätte, als Vorschlag im Admin. */
  automatisch?: number;
};

/**
 * Davids eigene Angabe (David, 3. November 2026: „ich möchte die freien
 * Plätze selbst eintragen können“). Die gerechnete Zahl bleibt als
 * Vorschlag sichtbar, zählt aber nicht, solange `aktiv` gesetzt ist.
 */
export type PlatzEinstellung = {
  aktiv: boolean;
  freie: number;
  zusatz: string | null;
};

export const EINSTELLUNG_PLAETZE = "platzstatus_manuell";

/** Liest die Einstellung robust, auch wenn etwas Unerwartetes drinsteht. */
export function leseEinstellung(wert: unknown): PlatzEinstellung | null {
  if (!wert || typeof wert !== "object") return null;
  const w = wert as Record<string, unknown>;
  const freie = Number(w.freie);
  if (!Number.isFinite(freie)) return null;
  const zusatz = typeof w.zusatz === "string" && w.zusatz.trim() ? w.zusatz.trim().slice(0, 60) : null;
  return { aktiv: w.aktiv === true, freie: Math.max(0, Math.round(freie)), zusatz };
}

/** Eigene Zahl vor gerechneter, wenn eingeschaltet. */
export function wendeEinstellungAn(
  automatisch: number,
  wartende: number,
  einstellung: PlatzEinstellung | null
): Platzstatus {
  if (einstellung?.aktiv) {
    return {
      freiePlaetze: einstellung.freie,
      wartende,
      stufe: platzstufe(einstellung.freie),
      zusatz: einstellung.zusatz,
      manuell: true,
      automatisch,
    };
  }
  return {
    freiePlaetze: automatisch,
    wartende,
    stufe: platzstufe(automatisch),
    zusatz: null,
    manuell: false,
    automatisch,
  };
}

export function platzstufe(freiePlaetze: number): Platzstatus["stufe"] {
  if (freiePlaetze <= 0) return "ausgebucht";
  if (freiePlaetze <= WENIGE_PLAETZE) return "wenige";
  return "frei";
}

/** Der Text im Hinweis. `null` = kein Hinweis. */
export function platzText(status: Platzstatus): string | null {
  if (status.stufe === "ausgebucht") return "Zurzeit ausgebucht, die Warteliste ist offen";
  if (status.stufe === "wenige") {
    const basis =
      status.freiePlaetze === 1
        ? "Nur noch 1 freier Platz"
        : `Nur noch ${status.freiePlaetze} freie Plätze`;
    return status.zusatz ? `${basis} ${status.zusatz}` : basis;
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
