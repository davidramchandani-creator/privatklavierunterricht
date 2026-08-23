// ============================================================
// Wann wird an eine offene Rechnung erinnert?
//
// Reine Regeln, keine Datenbank — damit sich die Fristen ohne Aufbau
// durchspielen lassen. Der Zugriff liegt in mahnung-server.ts.
//
// ── Zwei Arten von Stillstand ───────────────────────────────
//
// Eine Rechnung kann aus zwei ganz verschiedenen Gründen offen sein, und
// die Verwechslung wäre peinlich:
//
//   unpaid                 Der Schüler hat nicht bezahlt.
//                          → Er wird erinnert, freundlich, in zwei Stufen.
//
//   pending_confirmation   Der Schüler hat auf „Ich habe bezahlt" gedrückt,
//                          David hat es nicht bestätigt.
//                          → **David** wird erinnert. Eine Mahnung an den
//                            Schüler wäre hier ein Vorwurf für etwas, das
//                            er längst erledigt hat.
//
// ── Warum zwei Stufen und nicht eine ────────────────────────
//
// Die erste Erinnerung ist eine Freundlichkeit: Rechnungen gehen im Alltag
// unter, ein Hinweis genügt fast immer. Bleibt es danach still, hilft eine
// zweite gleichlautende Mail nichts mehr — dann muss David selbst ran,
// und dafür bekommt er den Hinweis. Automatische dritte, vierte und fünfte
// Mahnungen beschädigen bloss das Verhältnis zu Leuten, die man jede Woche
// im Wohnzimmer trifft.
// ============================================================

/** Erste Erinnerung: eine Woche nach Fälligkeit. */
export const ERSTE_MAHNUNG_TAGE = 7;

/**
 * Zweite Erinnerung: drei Wochen nach Fälligkeit, also zwei Wochen nach
 * der ersten. Genug Zeit für Ferien und einen vergessenen Zahlungsauftrag.
 */
export const ZWEITE_MAHNUNG_TAGE = 21;

/** Danach übernimmt David persönlich. Mehr als zwei Mails schickt niemand. */
export const MAX_MAHNSTUFE = 2;

/**
 * So lange darf eine gemeldete Zahlung auf Davids Bestätigung warten,
 * bevor er einen Hinweis bekommt. Kurz gehalten: Der Schüler sieht in
 * seinem Portal „in Prüfung" und wartet.
 */
export const BESTAETIGUNG_WARTET_TAGE = 3;

/** Höchstens alle so viele Tage denselben Hinweis wiederholen. */
export const HINWEIS_WIEDERHOLUNG_TAGE = 7;

export type OffeneRechnung = {
  id: string;
  status: string;
  /** Fälligkeit; fehlt sie, zählt das Erstelldatum. */
  faellig: string | null;
  erstellt: string;
  mahnstufe: number;
  erinnertAm: string | null;
  bestaetigungErinnertAm: string | null;
};

export type Mahnentscheid =
  | { art: "keine" }
  | { art: "schueler_erinnern"; stufe: 1 | 2 }
  | { art: "admin_bestaetigen" };

/** Ganze Tage zwischen zwei Zeitpunkten, abgerundet. */
function tageSeit(zeitpunkt: string, jetzt: Date): number {
  return Math.floor(
    (jetzt.getTime() - new Date(zeitpunkt).getTime()) / 86400000
  );
}

/**
 * Was ist mit dieser Rechnung heute zu tun?
 *
 * Bewusst eine einzige Funktion mit allen Regeln an einem Ort: Verteilt
 * über Abfragen und Bedingungen wäre nicht mehr nachvollziehbar, warum
 * jemand eine Mail bekommen hat — und genau das muss man beantworten
 * können, wenn ein Schüler zurückschreibt.
 */
export function entscheide(r: OffeneRechnung, jetzt: Date): Mahnentscheid {
  // Gemeldet, aber nicht bestätigt: Davids Baustelle, nicht die des Schülers.
  if (r.status === "pending_confirmation") {
    const wartetSeit = tageSeit(r.erinnertAm ?? r.erstellt, jetzt);
    if (wartetSeit < BESTAETIGUNG_WARTET_TAGE) return { art: "keine" };
    if (
      r.bestaetigungErinnertAm &&
      tageSeit(r.bestaetigungErinnertAm, jetzt) < HINWEIS_WIEDERHOLUNG_TAGE
    ) {
      return { art: "keine" };
    }
    return { art: "admin_bestaetigen" };
  }

  if (r.status !== "unpaid") return { art: "keine" };
  if (r.mahnstufe >= MAX_MAHNSTUFE) return { art: "keine" };

  const ueberfaelligSeit = tageSeit(r.faellig ?? r.erstellt, jetzt);

  // Nach der ersten Mahnung nicht sofort die zweite hinterherschicken,
  // auch wenn die Rechnung schon lange offen ist — sonst kämen bei einer
  // alten Rechnung beide Mails am selben Tag.
  if (
    r.erinnertAm &&
    tageSeit(r.erinnertAm, jetzt) < ZWEITE_MAHNUNG_TAGE - ERSTE_MAHNUNG_TAGE
  ) {
    return { art: "keine" };
  }

  if (r.mahnstufe === 0 && ueberfaelligSeit >= ERSTE_MAHNUNG_TAGE) {
    return { art: "schueler_erinnern", stufe: 1 };
  }
  if (r.mahnstufe === 1 && ueberfaelligSeit >= ZWEITE_MAHNUNG_TAGE) {
    return { art: "schueler_erinnern", stufe: 2 };
  }
  return { art: "keine" };
}
