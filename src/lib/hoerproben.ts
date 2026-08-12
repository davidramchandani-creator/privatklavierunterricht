// ============================================================
// Hörproben
//
// Der überzeugendste Beweis für einen Klavierlehrer ist, ihn spielen zu
// hören. Drei Sekunden Klang sagen mehr als vier Bewertungen — darum steht
// dieser Abschnitt weit oben, direkt nach dem Hero.
// ============================================================

export type Hoerprobe = {
  id: string;
  titel: string;
  /** Komponist, Arrangement oder „Eigene Improvisation". */
  herkunft: string;
  /** Datei unter /public/hoerproben/. */
  datei: string;
  /** Länge in Sekunden – für die Anzeige, bevor die Datei geladen ist. */
  dauer: number;
  /**
   * Wellenform als Höhen zwischen 0 und 1.
   *
   * Bewusst vorberechnet und nicht zur Laufzeit aus der Datei gelesen: Eine
   * Analyse im Browser bräuchte die vollständige Datei im Speicher, verzögert
   * den Start um Sekunden und bricht auf manchen mobilen Browsern ganz. So
   * steht die Wellenform sofort, auch bevor jemand auf Abspielen drückt.
   *
   * Erzeugen mit:
   *   ffmpeg -i stueck.mp3 -ac 1 -filter:a aresample=8000 -map 0:a -c:a pcm_s16le -f data - \
   *     | node scripts/wellenform.mjs
   */
  wellenform: number[];
};

/**
 * Was hier stehen sollte, sobald Aufnahmen da sind:
 *
 *   • ein klassisches Stück — zeigt Handwerk
 *   • ein Pop-Arrangement — zeigt, dass es nicht nur Klassik gibt
 *   • etwas Eigenes oder Improvisiertes — zeigt Persönlichkeit
 *   • wenn möglich eine Schüleraufnahme (mit Erlaubnis) — nichts überzeugt
 *     Eltern mehr als ein Kind, das nach einem Jahr etwas Erkennbares spielt
 *
 * Je 30–60 Sekunden, nicht ganze Werke. Niemand hört zwei Minuten zu, bevor
 * er weiterscrollt.
 *
 * Solange die Liste leer ist, erscheint der Abschnitt gar nicht. Ein leerer
 * Zustand mit „Bald verfügbar" wäre auf einer Verkaufsseite schädlicher als
 * gar kein Abschnitt.
 */
export const HOERPROBEN: Hoerprobe[] = [];

/** Sekunden als "2:14". */
export function formatDauer(sekunden: number): string {
  const min = Math.floor(sekunden / 60);
  const sek = Math.floor(sekunden % 60);
  return `${min}:${String(sek).padStart(2, "0")}`;
}
