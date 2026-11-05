// ============================================================
// Gruppenunterricht: zu zweit oder zu dritt
//
// David, 5. November 2026: Neben dem Einzelunterricht gibt es feste
// Gruppen im Abo, wie beim Einzelabo mit festem Wochentag und fester Zeit.
// Jede Person hat ein eigenes Abo, eigene Raten und eine eigene Rechnung.
//
//   Gruppe     Dauer   Semesterabo   Jahresabo   (pro Person und Lektion)
//   zu zweit   60 Min  CHF 65        CHF 60
//   zu dritt   60 Min  CHF 55        CHF 50
//
// Jahresabo je 5 Franken tiefer, wie beim Einzelunterricht.
//
// Fehlt jemand, findet die Lektion für die anderen trotzdem statt, und
// alle zahlen. Die Gruppe hat einen festen Platz (Antwort David).
//
// Diese Datei ist die einzige Stelle mit diesen Zahlen. Webseite, FAQ und
// später das Admin lesen von hier.
// ============================================================

export type Gruppengroesse = 2 | 3;

export const GRUPPENUNTERRICHT: Record<
  Gruppengroesse,
  { label: string; minuten: number; semester: number; jahr: number }
> = {
  2: { label: "Zu zweit", minuten: 60, semester: 65, jahr: 60 },
  3: { label: "Zu dritt", minuten: 60, semester: 55, jahr: 50 },
};

/** Was eine Lektion für die ganze Gruppe zusammen kostet. */
export function gruppenTotal(groesse: Gruppengroesse, variante: "semester" | "jahr"): number {
  return GRUPPENUNTERRICHT[groesse][variante] * groesse;
}

/** Die Regel bei Abwesenheit, für AGB, FAQ und Webseite gleich formuliert. */
export const GRUPPE_ABWESENHEIT =
  "Fehlt jemand, findet die Lektion für die anderen trotzdem statt, und alle zahlen ihren Anteil. Die Gruppe hat einen festen Platz, eine verpasste Lektion wird weder ersetzt noch zurückerstattet.";
