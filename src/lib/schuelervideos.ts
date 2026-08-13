// ============================================================
// Schülervideos
//
// Das stärkste Material, das ein Klavierlehrer haben kann. Stärker als die
// eigenen Aufnahmen. Eltern wollen nicht hören, wie gut du spielst; sie
// wollen sehen, was aus ihrem Kind wird.
//
// ── Was gezeigt wird ────────────────────────────────────────
//
// **Nur Hände auf den Tasten, keine Gesichter.** Damit ist niemand
// erkennbar, und die Frage nach Bildrechten stellt sich in entschärfter
// Form. Wer trotzdem sicher gehen will, fragt kurz nach. Es kostet eine
// Nachricht und erspart ein unangenehmes Gespräch.
//
// **Ton startet stumm.** Nicht nur, weil Browser Autoplay mit Ton ohnehin
// blockieren: Hört man ein Kind lachen oder sprechen, ist die Stimme wieder
// ein personenbezogenes Merkmal. Wer den Ton will, schaltet ihn ein.
// ============================================================

export type Schuelervideo = {
  id: string;
  /** Was gespielt wird. */
  titel: string;
  /** Wer spielt. */
  name: string;
  /**
   * In welcher Unterrichtswoche die Aufnahme entstand.
   *
   * Als Zahl, nicht als Satz („nach 5 Wochen"): Der Wert wird gezeichnet,
   * gross auf dem Standbild und als Punkt auf der Zeitachse. Steckt er in
   * einem Satz, kann man ihn nur vorlesen.
   *
   * Alle vier nehmen wöchentlich Unterricht, Woche 5 heisst also fünf
   * Lektionen. Dass sie bei Null angefangen haben, steht einmal über dem
   * Block, in jeder Zeile wiederholt, hörte man auf, es zu bemerken.
   */
  woche: number;
  /** Video unter /public/schuelervideos/. */
  datei: string;
  /** Standbild, gleicher Ordner. Ohne bleibt ein schwarzer Kasten stehen. */
  poster: string;
  /** Länge in Sekunden. */
  dauer: number;
};

/**
 * Reihenfolge ist Absicht: Diegos zwei Aufnahmen stehen nebeneinander, erst
 * „Happy Birthday" nach fünf Wochen, dann „Für Elise" nach sechs. Man sieht
 * denselben Menschen eine Woche später, das erzählt mehr als vier
 * unverbundene Einzelstücke.
 *
 * Ist die Liste leer, zeigt der Bewertungsabschnitt nur die Zitate. Kein
 * Platzhalter, kein „Videos folgen".
 *
 * Videos hinzufügen:
 *   1. Rohdatei nach public/schuelervideos/ legen
 *   2. node scripts/video-aufbereiten.mjs public/schuelervideos/datei.mov
 *      → verkleinert, gleicht die Lautstärke an, erzeugt das Standbild
 *   3. Den ausgegebenen Block hier eintragen
 */
export const SCHUELERVIDEOS: Schuelervideo[] = [
  {
    id: "diego-happy-birthday",
    titel: "Happy Birthday",
    name: "Diego",
    woche: 5,
    datei: "/schuelervideos/diego-happy-birthday.mp4",
    poster: "/schuelervideos/diego-happy-birthday.jpg",
    dauer: 21,
  },
  {
    id: "diego-fuer-elise",
    titel: "Für Elise",
    name: "Diego",
    woche: 6,
    datei: "/schuelervideos/diego-fuer-elise.mp4",
    poster: "/schuelervideos/diego-fuer-elise.jpg",
    dauer: 22,
  },
  {
    id: "phia-another-love",
    titel: "Another Love",
    name: "Phia",
    woche: 5,
    datei: "/schuelervideos/phia-another-love.mp4",
    poster: "/schuelervideos/phia-another-love.jpg",
    dauer: 44,
  },
  {
    id: "regina-the-cat",
    titel: "The Cat",
    name: "Regina",
    woche: 4,
    datei: "/schuelervideos/regina-the-cat.mp4",
    poster: "/schuelervideos/regina-the-cat.jpg",
    dauer: 74,
  },
];
