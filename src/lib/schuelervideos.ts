// ============================================================
// Schülervideos
//
// Das stärkste Material, das ein Klavierlehrer haben kann — stärker als die
// eigenen Aufnahmen. Eltern wollen nicht hören, wie gut du spielst; sie
// wollen sehen, was aus ihrem Kind wird.
//
// ── Was gezeigt wird ────────────────────────────────────────
//
// **Nur Hände auf den Tasten, keine Gesichter.** Damit ist niemand
// erkennbar, und die Frage nach Bildrechten stellt sich in entschärfter
// Form. Wer trotzdem sicher gehen will, fragt kurz nach — es kostet eine
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
  /**
   * Wer spielt und seit wann — „Diego, nach 5 Wochen".
   *
   * Die Zeitangabe ist der eigentliche Punkt: Ein Stück zu hören sagt wenig,
   * „nach 5 Wochen" sagt einem Elternteil genau, was es wissen will.
   *
   * Dass alle vier bei Null angefangen haben, steht bewusst **nicht** hier,
   * sondern einmal über dem Block. In jeder Zeile wiederholt, hörte man auf,
   * es zu bemerken.
   */
  wer: string;
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
 * denselben Menschen eine Woche später — das erzählt mehr als vier
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
    wer: "Diego, nach 5 Wochen",
    datei: "/schuelervideos/diego-happy-birthday.mp4",
    poster: "/schuelervideos/diego-happy-birthday.jpg",
    dauer: 21,
  },
  {
    id: "diego-fuer-elise",
    titel: "Für Elise",
    wer: "Diego, eine Woche später",
    datei: "/schuelervideos/diego-fuer-elise.mp4",
    poster: "/schuelervideos/diego-fuer-elise.jpg",
    dauer: 22,
  },
  {
    id: "phia-another-love",
    titel: "Another Love",
    wer: "Phia, nach 5 Wochen",
    datei: "/schuelervideos/phia-another-love.mp4",
    poster: "/schuelervideos/phia-another-love.jpg",
    dauer: 44,
  },
  {
    id: "regina-the-cat",
    titel: "The Cat",
    wer: "Regina, nach 4 Wochen",
    datei: "/schuelervideos/regina-the-cat.mp4",
    poster: "/schuelervideos/regina-the-cat.jpg",
    dauer: 74,
  },
];
