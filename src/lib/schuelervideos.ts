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
   * Wie weit die Person war, als die Aufnahme entstand.
   *
   * Früher eine blosse Zahl (`woche: 5`), und über dem Block stand
   * pauschal „Niemand hier hatte vorher je am Klavier gesessen. Eine
   * Lektion pro Woche". Das trug genau so lange, wie alle Aufnahmen von
   * Anfängern im Wochenrhythmus stammten.
   *
   * Marina passt da nicht hinein: Sie spielt seit einem Jahr und kommt
   * alle zwei Wochen. „Woche 9" hätte behauptet, sie könne das nach neun
   * Lektionen von null weg. Eine Zahl, die etwas Falsches nahelegt, ist
   * schlimmer als ein Satz, den man lesen muss.
   *
   * Darum ein freier, kurzer Text. Er steht als Zeile über dem Titel und
   * ist das Erste, was man liest.
   */
  stand: string;
  /** Video unter /public/schuelervideos/. */
  datei: string;
  /** Standbild, gleicher Ordner. Ohne bleibt ein schwarzer Kasten stehen. */
  poster: string;
  /** Länge in Sekunden. */
  dauer: number;
};

/**
 * Reihenfolge ist Absicht: Diegos drei Aufnahmen stehen beieinander, erst
 * „Happy Birthday" nach fünf Wochen, dann „Für Elise" nach sechs, dann
 * „Pirates of the Caribbean" nach zehn. Man sieht denselben Menschen
 * dreimal weiterkommen, und das erzählt mehr als lauter unverbundene
 * Einzelstücke.
 *
 * Auf breiten Bildschirmen füllt Diegos Reihe damit genau die erste Zeile,
 * darunter stehen Phia und Regina. Das ist kein Zufall, sondern der Grund
 * für diese Reihenfolge: Der Weg liegt in einer Linie nebeneinander.
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
    stand: "Woche 5",
    datei: "/schuelervideos/diego-happy-birthday.mp4",
    poster: "/schuelervideos/diego-happy-birthday.jpg",
    dauer: 21,
  },
  {
    id: "diego-fuer-elise",
    titel: "Für Elise",
    name: "Diego",
    stand: "Woche 6",
    datei: "/schuelervideos/diego-fuer-elise.mp4",
    poster: "/schuelervideos/diego-fuer-elise.jpg",
    dauer: 22,
  },
  {
    id: "diego-pirates-of-the-caribbean",
    titel: "Pirates of the Caribbean",
    name: "Diego",
    stand: "Woche 10",
    datei: "/schuelervideos/diego-pirates-of-the-caribbean.mp4",
    poster: "/schuelervideos/diego-pirates-of-the-caribbean.jpg",
    dauer: 36,
  },
  {
    id: "phia-another-love",
    titel: "Another Love",
    name: "Phia",
    stand: "Woche 5",
    datei: "/schuelervideos/phia-another-love.mp4",
    poster: "/schuelervideos/phia-another-love.jpg",
    dauer: 44,
  },
  {
    id: "regina-the-cat",
    titel: "The Cat",
    name: "Regina",
    stand: "Woche 4",
    datei: "/schuelervideos/regina-the-cat.mp4",
    poster: "/schuelervideos/regina-the-cat.jpg",
    dauer: 74,
  },
  {
    /*
      Marina ist der Grund, warum aus der Wochenzahl ein freier Text wurde.
      Sie spielt seit rund einem Jahr und kommt alle zwei Wochen. Dieses
      Stück haben die beiden in etwa vier Monaten aufgebaut, und genau das
      steht da, nichts Grösseres.
    */
    id: "marina-something-strange",
    titel: "Something Strange",
    name: "Marina",
    stand: "In 4 Monaten aufgebaut",
    datei: "/schuelervideos/marina-something-strange.mp4",
    poster: "/schuelervideos/marina-something-strange.jpg",
    dauer: 56,
  },
];
