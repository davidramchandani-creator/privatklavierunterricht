// ============================================================
// Wochen- und Monatsbriefing: die Regeln
//
// Was gehört in ein Briefing und was nicht? Die Antwort entscheidet, ob
// David es nach drei Wochen noch liest. Leitsatz hier: **nur was eine
// Handlung auslöst.**
//
// Eine Zeile „5 Lektionen diese Woche" ist Dekoration — das sieht er im
// Kalender. Eine Zeile „Marina hat seit 5 Wochen keine Lektion gebucht"
// ist es nicht: Sie bedeutet, dass jemand still verschwindet, und darauf
// kann er reagieren, solange es noch geht.
//
// Darum ist ein Briefing ohne Auffälligkeiten **leer** und wird gar nicht
// erst verschickt. Eine Mail, die jede Woche kommt und meistens „alles in
// Ordnung" sagt, trainiert einen darauf, sie ungelesen zu löschen — und
// dann fehlt sie in der einen Woche, in der etwas drinsteht.
//
// Reine Funktionen, kein DB-Zugriff. Der liegt in briefing-server.ts.
// ============================================================

/** Ab so vielen Wochen ohne gebuchte Lektion wird jemand auffällig. */
export const STILL_SEIT_WOCHEN = 4;

/** So weit im Voraus wird auf ein auslaufendes Abo hingewiesen. */
export const ABO_LAEUFT_AUS_TAGE = 30;

export type Wochenpunkt = {
  art:
    | "lektionen"
    | "offene_zahlung"
    | "wartet_auf_bestaetigung"
    | "still"
    | "abo_laeuft_aus"
    | "unbeantwortet";
  /** Ein Satz, der ohne die Zahlen dahinter verständlich ist. */
  text: string;
  /** Wie dringend, für die Sortierung. Höher = weiter oben. */
  gewicht: number;
};

export type Wochenbriefing = {
  /** Montag der Woche, YYYY-MM-DD. */
  woche: string;
  lektionen: number;
  punkte: Wochenpunkt[];
  /** Nichts zu berichten? Dann wird nicht verschickt. */
  lohntSich: boolean;
};

/**
 * Baut das Wochenbriefing aus den bereits geladenen Zahlen.
 *
 * Die Lektionszahl steht immer oben — nicht als Handlungsaufforderung,
 * sondern als Einordnung: Eine Woche mit zwölf Lektionen liest man anders
 * als eine mit dreien. Sie allein löst aber kein Briefing aus.
 */
export function baueWochenbriefing(params: {
  woche: string;
  lektionen: number;
  offeneZahlungen: { anzahl: number; betrag: number };
  wartetAufBestaetigung: number;
  stilleSchueler: string[];
  abosLaufenAus: { name: string; bis: string }[];
  unbeantworteteAnfragen: number;
}): Wochenbriefing {
  const punkte: Wochenpunkt[] = [];

  if (params.lektionen > 0) {
    punkte.push({
      art: "lektionen",
      text:
        params.lektionen === 1
          ? "Eine Lektion diese Woche."
          : `${params.lektionen} Lektionen diese Woche.`,
      gewicht: 0,
    });
  }

  // Geld zuerst: Es ist das Einzige, was mit der Zeit schlechter wird.
  if (params.offeneZahlungen.anzahl > 0) {
    const chf = params.offeneZahlungen.betrag.toLocaleString("de-CH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    punkte.push({
      art: "offene_zahlung",
      text:
        params.offeneZahlungen.anzahl === 1
          ? `Eine Rechnung ist offen, CHF ${chf}.`
          : `${params.offeneZahlungen.anzahl} Rechnungen sind offen, zusammen CHF ${chf}.`,
      gewicht: 90,
    });
  }

  if (params.wartetAufBestaetigung > 0) {
    punkte.push({
      art: "wartet_auf_bestaetigung",
      text:
        params.wartetAufBestaetigung === 1
          ? "Eine gemeldete Zahlung wartet auf deine Bestätigung."
          : `${params.wartetAufBestaetigung} gemeldete Zahlungen warten auf deine Bestätigung.`,
      gewicht: 80,
    });
  }

  // Stille Schüler sind der teuerste Posten überhaupt: Wer aufhört, ohne
  // es zu sagen, kostet nicht eine Lektion, sondern alle künftigen.
  if (params.stilleSchueler.length > 0) {
    punkte.push({
      art: "still",
      text: `Seit über ${STILL_SEIT_WOCHEN} Wochen keine Lektion: ${params.stilleSchueler.join(", ")}.`,
      gewicht: 70,
    });
  }

  if (params.abosLaufenAus.length > 0) {
    punkte.push({
      art: "abo_laeuft_aus",
      text: params.abosLaufenAus
        .map((a) => `${a.name} (bis ${a.bis})`)
        .join(", "),
      gewicht: 60,
    });
  }

  if (params.unbeantworteteAnfragen > 0) {
    punkte.push({
      art: "unbeantwortet",
      text:
        params.unbeantworteteAnfragen === 1
          ? "Eine Anfrage ist unbeantwortet."
          : `${params.unbeantworteteAnfragen} Anfragen sind unbeantwortet.`,
      gewicht: 95,
    });
  }

  punkte.sort((a, b) => b.gewicht - a.gewicht);

  // Nur die Lektionszahl ist kein Grund für eine Mail.
  const lohntSich = punkte.some((p) => p.gewicht > 0);

  return { woche: params.woche, lektionen: params.lektionen, punkte, lohntSich };
}

export type Monatsbriefing = {
  /** YYYY-MM des abgeschlossenen Monats. */
  monat: string;
  einnahmen: number;
  ausgaben: number;
  ergebnis: number;
  lektionen: number;
  /** Differenz der Einnahmen zum Vormonat, in Franken. */
  gegenVormonat: number;
  /** Noch nicht bestätigte externe Lektionen, als Merkposten. */
  geschaetzt: number;
  offeneRechnungen: { anzahl: number; betrag: number };
};

/** Wie stark sich der Monat vom Vormonat unterscheidet, in Prozent. */
export function veraenderungProzent(jetzt: number, vorher: number): number | null {
  // Ohne Vormonatszahl gibt es nichts zu vergleichen — und eine Steigerung
  // „von 0 auf 300" in Prozent auszudrücken ergibt keinen sinnvollen Wert.
  if (vorher <= 0) return null;
  return Math.round(((jetzt - vorher) / vorher) * 100);
}
