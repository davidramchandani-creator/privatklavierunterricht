// ============================================================
// Lektionsnotizen: Regeln ohne Datenbank
//
// Was hier steht, ist bewusst rein rechnerisch — damit es prüfbar ist, ohne
// eine Lektion anzulegen.
// ============================================================

/** Woran gearbeitet wurde. Mehrfachauswahl. */
export const INHALTE = [
  { id: "stueck", label: "Stück" },
  { id: "technik", label: "Technik" },
  { id: "theorie", label: "Theorie" },
  { id: "gehoer", label: "Gehör" },
  { id: "improvisation", label: "Improvisation" },
  { id: "begleitung", label: "Begleitung" },
] as const;

export type InhaltId = (typeof INHALTE)[number]["id"];

/**
 * Wie es lief. Genau eines.
 *
 * Drei Stufen, nicht fünf. Bei fünf denkt man beim Antippen nach, und Nachdenken
 * ist genau das, was das Eintragen um Minuten verlängert und es damit auf Dauer
 * verhindert.
 */
export const VERLAEUFE = [
  { id: "sitzt", label: "Sitzt", ton: "success" as const },
  { id: "dranbleiben", label: "Dranbleiben", ton: "pending" as const },
  { id: "neu", label: "Neu angefangen", ton: "info" as const },
] as const;

export type VerlaufId = (typeof VERLAEUFE)[number]["id"];

export function inhaltLabel(id: string): string {
  return INHALTE.find((i) => i.id === id)?.label ?? id;
}

export function verlaufLabel(id: string | null): string | null {
  if (!id) return null;
  return VERLAEUFE.find((v) => v.id === id)?.label ?? id;
}

export type Notiz = {
  appointment_id: string;
  inhalt: string[];
  verlauf: string | null;
  woran: string | null;
  hausaufgabe: string | null;
  /** Beginn der Lektion, zu der die Notiz gehört (ISO). */
  lektion_am: string;
};

export type Vorschau = {
  /** Was der Schüler üben sollte. Der wichtigste Satz vor der Lektion. */
  hausaufgabe: string | null;
  /** Woran zuletzt gearbeitet wurde. */
  zuletzt: string | null;
  /** Wann das war (ISO), für „vor zwei Wochen". */
  zuletztAm: string | null;
  /** Die Kategorien der letzten Lektion. */
  inhalt: string[];
  /**
   * Wie viele Lektionen in Folge zuletzt auf „dranbleiben" standen.
   *
   * Das ist die einzige Zahl hier, die etwas verrät, das man sonst nicht
   * merkt: Ein einzelnes „dranbleiben" ist normal. Vier hintereinander
   * heissen, dass die Methode nicht greift und nicht der Schüler zu wenig übt.
   */
  dranbleibenSeit: number;
  /** Es gibt zu diesem Schüler noch gar keine Notiz. */
  leer: boolean;
};

/**
 * Baut den Stand vor der nächsten Lektion.
 *
 * `notizen` muss nach Lektionsdatum absteigend sortiert sein — neueste zuerst.
 */
export function baueVorschau(notizen: Notiz[]): Vorschau {
  if (notizen.length === 0) {
    return {
      hausaufgabe: null,
      zuletzt: null,
      zuletztAm: null,
      inhalt: [],
      dranbleibenSeit: 0,
      leer: true,
    };
  }

  const neueste = notizen[0];

  // Die Hausaufgabe der letzten Lektion, und wenn dort keine steht, die
  // letzte, die überhaupt gestellt wurde. Sonst stünde nach einer Stunde ohne
  // Hausaufgabe gar nichts da, obwohl vom Mal davor noch etwas offen ist.
  const hausaufgabe =
    notizen.find((n) => n.hausaufgabe && n.hausaufgabe.trim().length > 0)
      ?.hausaufgabe?.trim() ?? null;

  let dranbleibenSeit = 0;
  for (const n of notizen) {
    if (n.verlauf === "dranbleiben") dranbleibenSeit++;
    else break;
  }

  return {
    hausaufgabe,
    zuletzt: neueste.woran?.trim() || null,
    zuletztAm: neueste.lektion_am,
    inhalt: neueste.inhalt ?? [],
    dranbleibenSeit,
    leer: false,
  };
}

/**
 * Ist die Notiz leer genug, dass Speichern nichts brächte?
 *
 * Ein leerer Eintrag wäre schlimmer als keiner: Die Lektion verschwände aus
 * der Liste der offenen Notizen, ohne dass irgendwo etwas stünde.
 */
export function istLeer(n: {
  inhalt: string[];
  verlauf: string | null;
  woran: string | null;
  hausaufgabe: string | null;
}): boolean {
  return (
    n.inhalt.length === 0 &&
    !n.verlauf &&
    !n.woran?.trim() &&
    !n.hausaufgabe?.trim()
  );
}

/**
 * Wie lange nach Lektionsende gefragt wird.
 *
 * Nicht sofort: Die letzten Minuten gehören dem Verabschieden, und wer im
 * Hausflur steht, tippt nichts ein.
 */
export const FRAGEN_NACH_MINUTEN = 15;

/**
 * Wie weit zurück offene Notizen überhaupt noch angeboten werden.
 *
 * Nach zwei Wochen weiss man ohnehin nicht mehr, was in der Stunde lief. Eine
 * Liste, die endlos wächst, wird zur Mahnung, die man wegklickt — und dann
 * klickt man auch die frischen weg.
 */
export const OFFEN_MAX_TAGE = 14;
