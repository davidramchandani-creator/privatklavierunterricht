// ============================================================
// Bewertungen
//
// Sie standen einmal als feste Liste in dieser Datei. Jetzt kommen sie aus
// der Datenbank, weil Schüler selbst welche abgeben können und niemand für
// jedes Lob den Code anfassen soll.
//
// ── Warum die Zahl nirgends getippt wird ────────────────────
//
// Drei Stellen auf der Website nennen die Anzahl: der Abschnitt selbst, das
// Abzeichen im Hero und die Zahlenreihe auf „Über mich". Zwei davon hatten
// „aus 4 Bewertungen" ausgeschrieben. Als die fünfte dazukam, log die Seite
// an beiden Stellen weiter, und gemerkt hätte es niemand, weil beim Lesen
// niemand die Karten nachzählt. Anzahl und Schnitt werden deshalb gerechnet,
// und ein Test (bewertungen.test.ts) lässt feste Zahlen nicht zurück.
//
// ── Sterne ohne Text ────────────────────────────────────────
//
// Zwei Leute haben im alten System fünf Sterne gegeben, ohne etwas zu
// schreiben. Ihre Wertung zählt: Sie ist ja abgegeben worden. Eine Karte
// bekommen sie nicht, denn ein leeres Zitatfeld sieht nach Fehler aus.
// Deshalb die Trennung unten in `liste` (hat Text, wird gezeigt) und
// `anzahl` (alle, wird gezählt).
//
// ── Zum Kürzen ──────────────────────────────────────────────
//
// Es wird **weggelassen, nie umformuliert**. Kein Wort geglättet, keins
// ergänzt, keine Rechtschreibung korrigiert. Julian schrieb „auf dem
// Klavier. mit David", klein nach dem Punkt; genau so steht es da. Eine
// Bewertung, die jemand für den Autor schöner geschrieben hat, ist keine
// mehr, sondern Werbetext, und man hört den Unterschied beim Lesen sofort.
// ============================================================

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface Bewertung {
  id: string;
  sterne: number;
  /** Der volle Wortlaut, so wie abgeschickt. */
  text: string;
  /** Gekürzt für die Karten auf der Startseite. Fehlt sie, gilt `text`. */
  textKurz: string | null;
  name: string;
}

export interface Bewertungsdaten {
  /** Nur die mit Text. Diese bekommen eine Karte. */
  liste: Bewertung[];
  /** Alle freigegebenen, auch die ohne Text. */
  anzahl: number;
  /** Auf eine Nachkommastelle, gerechnet statt behauptet. */
  schnitt: string;
}

export const LEER: Bewertungsdaten = { liste: [], anzahl: 0, schnitt: "0.0" };

type Zeile = {
  id: string;
  sterne: number;
  text: string | null;
  text_kurz: string | null;
  name: string | null;
};

export function rechneDaten(zeilen: Zeile[]): Bewertungsdaten {
  if (zeilen.length === 0) return LEER;

  const schnitt = (
    zeilen.reduce((summe, z) => summe + z.sterne, 0) / zeilen.length
  ).toFixed(1);

  const liste: Bewertung[] = zeilen
    .filter((z): z is Zeile & { text: string; name: string } =>
      Boolean(z.text && z.name),
    )
    .map((z) => ({
      id: z.id,
      sterne: z.sterne,
      text: z.text,
      textKurz: z.text_kurz,
      name: z.name,
    }));

  return { liste, anzahl: zeilen.length, schnitt };
}

/**
 * Die freigegebenen Bewertungen.
 *
 * `cache` von React, damit drei Abschnitte auf derselben Seite nicht drei
 * Abfragen auslösen. Innerhalb einer Anfrage wird nur einmal gefragt.
 *
 * Kein Rückfall auf eine fest eingebaute Liste, falls die Datenbank
 * schweigt. Das war überlegt: Eine solche Liste veraltet unbemerkt und
 * widerspricht dann dem, was im Admin steht. Ausserdem holt schon der Hero
 * den nächsten freien Termin aus derselben Datenbank; ist sie weg, fehlt
 * ohnehin mehr als die Zitate.
 */
export const ladeBewertungen = cache(async (): Promise<Bewertungsdaten> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, sterne, text, text_kurz, name")
    .eq("status", "freigegeben")
    .order("reihenfolge", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return LEER;
  return rechneDaten(data as Zeile[]);
});
