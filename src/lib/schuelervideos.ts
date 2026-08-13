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
   * Wer spielt und seit wann — „Diego, seit einem Jahr".
   *
   * Die Zeitangabe ist der eigentliche Punkt: Ein Stück zu hören sagt wenig,
   * „nach einem Jahr" sagt einem Elternteil genau, was es wissen will.
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
 * Solange die Liste leer ist, zeigt der Bewertungsabschnitt nur die Zitate —
 * wie bisher. Kein Platzhalter, kein „Videos folgen".
 *
 * Videos hinzufügen:
 *   1. Rohdatei nach public/schuelervideos/ legen
 *   2. node scripts/video-aufbereiten.mjs public/schuelervideos/datei.mp4
 *      → verkleinert auf Webgrösse und erzeugt das Standbild
 *   3. Hier eintragen
 */
export const SCHUELERVIDEOS: Schuelervideo[] = [];
