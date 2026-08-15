// ============================================================
// Bewertungen
//
// Die Liste steht hier und nicht im Abschnitt, der sie anzeigt, weil drei
// Stellen auf der Website ihre Länge nennen: der Abschnitt selbst, das
// Abzeichen im Hero und die Zahlenreihe auf „Über mich". Zwei davon hatten
// die Zahl ausgeschrieben. Als Bewertungen dazukamen, stand dort weiter
// „aus 4 Bewertungen", und gemerkt hätte es niemand, weil niemand beim
// Lesen mitzählt.
//
// Darum die Regel: Die Zahl wird nirgends getippt, sie wird gezählt. Ein
// Test wacht darüber (bewertungen.test.ts).
//
// ── Zum Kürzen ──────────────────────────────────────────────
//
// Es wird **weggelassen, nie umformuliert**. Kein Wort wird geglättet,
// keins ergänzt, keine Rechtschreibung korrigiert. Eine Bewertung, die
// jemand für den Autor schöner geschrieben hat, ist keine Bewertung mehr,
// sondern Werbetext, und man hört den Unterschied beim Lesen sofort.
// ============================================================

export interface Bewertung {
  id: string;
  sterne: number;
  /** Gekürzt, für die Karten auf der Startseite. */
  text: string;
  /**
   * Der volle Wortlaut, für „Über mich". Dort hat man Zeit, dort darf es
   * lang sein. Fehlt der Eintrag, wird `text` genommen.
   *
   * Beide Fassungen stehen hier nebeneinander und nicht in den zwei
   * Seiten, die sie zeigen. Vorher war es getrennt, und prompt lagen auf
   * der Startseite vier Bewertungen und auf „Über mich" drei andere.
   */
  textLang?: string;
  name: string;
}

/**
 * Die Reihenfolge mischt die Herkunft absichtlich: erst ein Elternteil, ein
 * erwachsener Schüler und jemand, der selbst Musik macht, danach zwei
 * weitere Eltern. Sechs Zitate derselben Sorte lesen sich wie eines.
 * Sechs füllen ausserdem genau zwei Dreierreihen, ohne dass eine Karte
 * allein in der letzten Zeile steht.
 */
export const BEWERTUNGEN: Bewertung[] = [
  {
    id: "jan",
    sterne: 5,
    text: "David ist ein sehr engagierter Klavierlehrer. Er unterrichtet meine zwei Kinder seit gut einem halben Jahr wöchentlich. Die Kinder fühlen sich super wohl mit ihm, haben Freude am Klavier spielen und machen tolle Fortschritte. Wir können ihn von Herzen weiterempfehlen.",
    textLang:
      "Perfekt! David ist ein sehr engagierter Klavierlehrer. Er unterrichtet meine zwei Kinder seit gut einem halben Jahr wöchentlich. Die Kinder fühlen sich super wohl mit ihm, haben Freude am Klavier spielen und machen tolle Fortschritte. David ist professionell, kommuniziert super und er ist sehr zuverlässig. Wir können ihn von Herzen weiterempfehlen :).",
    name: "Jan",
  },
  {
    id: "pierre",
    sterne: 5,
    text: "Er hat eine sehr angenehme Art und Weise mir genau da zu helfen wo ich seine Hilfe benötige. Sehr vertrauenswürdige Lektionen auf schon fast kollegialer Basis. Toller Prof!",
    textLang:
      "Ich gehe zu ihm in die Stunden was ich keinen Moment bereue. Er hat eine sehr angenehme Art und Weise mir genau da zu helfen wo ich seine Hilfe benötige. Sehr vertrauenswürdige Lektionen auf schon fast kollegialer Basis, was ich enorm schätze. Toller Prof!",
    name: "Pierre",
  },
  {
    id: "julian",
    sterne: 5,
    // Das kleine „mit" nach dem Punkt ist keine Schlamperei von uns,
    // sondern steht so in seiner Bewertung. Korrigieren hiesse
    // umschreiben, und dann ist es nicht mehr seine.
    text: "Er ist ein sehr geduldiger Mensch und kann einem sehr viel beibringen auf dem Klavier. mit David hat man einen sehr guten, jungen Klavierlehrer der professionell und auf moderne Art und Weise Klavierunterricht erteilt.",
    textLang:
      "David spielt schon seit Kindheit Klavier und ich bin jedes mal überrascht wenn ich ihn spielen höre wie exakt und präzise er die Töne spielt. Er ist ein sehr geduldiger Mensch und kann einem sehr viel beibringen auf dem Klavier. mit David hat man einen sehr guten, jungen Klavierlehrer der professionell und auf moderne Art und Weise Klavierunterricht erteilt.",
    name: "Julian",
  },
  {
    id: "mirela",
    sterne: 5,
    text: "David ist eine natürliche und feine Persönlichkeit. Er unterrichtet mit Leidenschaft und Respekt für Klavier und Mitmenschen! Wir würden David jeder Zeit sehr gerne weiterempfehlen.",
    // Der Originaltext nennt den Vornamen des Kindes. Weggelassen: Auf
    // den Videos ist bewusst kein Gesicht zu sehen, dann sollte hier auch
    // kein Kindername stehen. Die Familie hat den Text bei Matchspace
    // geschrieben, nicht für diese Seite.
    textLang:
      "David ist eine natürliche und feine Persönlichkeit. Er verfügt über sehr gute Sozial- und Selbstkompetenzen. Er unterrichtet mit Leidenschaft und Respekt für Klavier und Mitmenschen! Wir würden David jeder Zeit sehr gerne weiterempfehlen. DANKE DAVID!",
    name: "Mirela",
  },
  {
    id: "flurina",
    sterne: 5,
    text: "Er ist sehr geduldig, kompetent und man spürt die Leidenschaft für seine Aufgabe. Unser Sohn freut sich jeweils sehr auf die Klavierstunden. Wir können David zu 100% weiterempfehlen.",
    textLang:
      "Wir sind sehr begeistert von David. Er ist sehr geduldig, kompetent und man spürt die Leidenschaft für seine Aufgabe. Unser Sohn freut sich jeweils sehr auf die Klavierstunden. Wir können David zu 100% weiterempfehlen.",
    name: "Flurina",
  },
  {
    id: "marina",
    sterne: 5,
    text: "Wir haben Spass zusammen zu spielen und zu lernen.",
    name: "Marina",
  },
];

export const ANZAHL_BEWERTUNGEN = BEWERTUNGEN.length;

/**
 * Der Schnitt, ausgerechnet statt behauptet.
 *
 * Steht heute überall als „5.0", weil bisher alle fünf Sterne gegeben
 * haben. Sobald einmal vier Sterne dabei sind, soll die Seite das auch
 * sagen und nicht weiter 5.0 behaupten.
 */
export const SCHNITT_BEWERTUNG = (
  BEWERTUNGEN.reduce((summe, b) => summe + b.sterne, 0) / BEWERTUNGEN.length
).toFixed(1);
