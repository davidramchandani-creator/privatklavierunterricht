/**
 * Gap-Aware Slot Generator (Feature 1).
 *
 * Problem: In einem offenen Block (z. B. 16:30–20:00) entstehen bei frei
 * wählbaren Startzeiten Lücken, die zu kurz für eine weitere Lektion sind.
 *
 * Regel (vom Betreiber vorgegeben):
 *   Eine Startzeit ist nur gültig, wenn sie die Kapazität des Blocks nicht
 *   unnötig verkleinert.
 *
 * Umsetzung: Statt mit Schwellwerten auf die Lücken zu schauen, wird direkt
 * gemessen, wie viele Lektionen nach der Buchung noch in den Block passen.
 * Gültig ist eine Startzeit genau dann, wenn danach exakt eine Lektion
 * weniger möglich ist als vorher. Wer eine Zeit wählt, die eine unbrauchbare
 * Restlücke erzeugt, verliert zwei Plätze statt einen – und die Zeit wird
 * gar nicht erst angeboten.
 *
 * Dieses Kriterium ist zugleich strenger (verhindert tote Lücken zuverlässig)
 * und grosszügiger (blockiert keine Zeiten, deren Rest ohnehin nie nutzbar
 * wäre, z. B. am Blockende) als eine reine Mindestlücken-Regel.
 *
 * Pufferzeit: Der Puffer (Fahrt-/Umstellzeit) zählt NICHT als Lücke, sondern
 * ist Teil der Belegung. Zwischen zwei aufeinanderfolgenden Lektionen liegt
 * immer genau `bufferMinutes`; an den Blockrändern wird kein Puffer verlangt.
 *
 * Diese Datei ist bewusst frei von Datenbank- und UI-Abhängigkeiten, damit
 * sie isoliert testbar bleibt. Alle Zeiten sind Minuten seit Mitternacht
 * (Zürcher Wandzeit) – die Umrechnung passiert an den Rändern.
 */

/** Minuten seit Mitternacht, z. B. 16:30 → 990. */
export type Minutes = number;

export type Interval = {
  start: Minutes;
  end: Minutes;
  /**
   * Puffer dieser Lektion (Fahrzeit zum/vom Schüler, aufgerundet aufs
   * Raster). Fehlt der Wert, gilt der Blockstandard.
   */
  bufferMinutes?: number;
};

export type BlockConfig = {
  /** Offener Block, z. B. { start: 990, end: 1200 } für 16:30–20:00. */
  block: Interval;
  /** Mindest-/Standarddauer einer Lektion in Minuten (konfigurierbar). */
  lessonMinutes: number;
  /** Puffer zwischen zwei Lektionen in Minuten. */
  bufferMinutes: number;
  /** Raster für Kandidaten-Startzeiten (Standard 15 Min). */
  gridMinutes?: number;
  /**
   * "lueckenlos" (Standard): Lektionen reihen sich bündig aneinander. Die
   *   Zeit vor einer Buchung muss exakt durch ganze Lektionen (inkl. Puffer)
   *   auffüllbar sein. Ergebnis: keine Löcher, dafür weniger Auswahl.
   * "maximal": Erlaubt jede Startzeit, die die Gesamtzahl möglicher
   *   Lektionen im Block nicht verringert. Mehr Auswahl für Schüler, dafür
   *   sind kleine unbrauchbare Löcher möglich (z. B. 15 Min am Blockanfang).
   */
  packing?: "lueckenlos" | "maximal";
};

export const DEFAULT_GRID_MINUTES = 15;

/** "16:30" → 990 */
export function hhmmToMinutes(hhmm: string): Minutes {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

/** 990 → "16:30" */
export function minutesToHhmm(min: Minutes): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Rechnet eine Fahrzeit in einen Puffer um: aufgerundet auf das Raster,
 * mindestens `minimum`. 20 Minuten Fahrt ergeben bei 15-Minuten-Raster also
 * 30 Minuten Puffer – so bleibt der Puffer mit dem Slot-Raster kompatibel.
 */
export function travelToBuffer(
  travelMinutes: number,
  gridMinutes = DEFAULT_GRID_MINUTES,
  minimum = DEFAULT_GRID_MINUTES
): number {
  if (!Number.isFinite(travelMinutes) || travelMinutes <= 0) return minimum;
  return Math.max(minimum, Math.ceil(travelMinutes / gridMinutes) * gridMinutes);
}

/**
 * Nötiger Abstand zwischen zwei aufeinanderfolgenden Lektionen. Massgeblich
 * ist der grössere der beiden Puffer – wer weiter weg wohnt, bestimmt die
 * Fahrzeit für diesen Übergang.
 */
function gapBetween(a: number | undefined, b: number | undefined, fallback: number): number {
  return Math.max(a ?? fallback, b ?? fallback);
}

/** Belegungen zeitlich sortieren und überlappende zusammenfassen. */
function normalize(occupied: Interval[]): Interval[] {
  const sorted = [...occupied]
    .filter((o) => o.end > o.start)
    .sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (last && cur.start < last.end) {
      last.end = Math.max(last.end, cur.end);
      last.bufferMinutes = Math.max(
        last.bufferMinutes ?? 0,
        cur.bufferMinutes ?? 0
      ) || undefined;
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * Prüft, ob eine einzelne Startzeit gültig ist.
 * Exportiert, damit auch serverseitig eine konkrete Buchungsanfrage
 * validiert werden kann (nie nur der Client-Auswahl vertrauen).
 */
export function isValidStart(
  start: Minutes,
  cfg: BlockConfig,
  occupied: Interval[] = [],
  /** Puffer des anfragenden Schülers; fehlt er, gilt der Blockstandard. */
  candidateBuffer?: number
): boolean {
  const { block, lessonMinutes } = cfg;
  const fallback = cfg.bufferMinutes;
  const mine = candidateBuffer ?? fallback;
  const packing = cfg.packing ?? "lueckenlos";
  const end = start + lessonMinutes;

  if (start < block.start || end > block.end) return false;

  const busy = normalize(occupied);

  // Überschneidung inkl. des jeweils massgeblichen Puffers ausschliessen.
  for (const b of busy) {
    const need = gapBetween(b.bufferMinutes, mine, fallback);
    if (start < b.end + need && b.start - need < end) return false;
  }

  const candidate: Interval = { start, end, bufferMinutes: mine };

  // Kriterium 1: Die Buchung darf genau einen Platz kosten.
  const before = remainingCapacity(cfg, busy, mine);
  const after = remainingCapacity(cfg, [...busy, candidate], mine);
  if (after !== before - 1) return false;

  if (packing === "maximal") return true;

  // Kriterium 2 (lueckenlos): Der Platz davor muss exakt auffüllbar sein.
  const prev = busy.filter((b) => b.end <= start).pop();
  const need = prev ? gapBetween(prev.bufferMinutes, mine, fallback) : 0;
  const usableFrom = prev ? prev.end + need : block.start;
  const gapBefore = start - usableFrom;
  if (gapBefore < 0) return false;
  return gapBefore % (lessonMinutes + mine) === 0;
}

/**
 * Liefert alle gültigen Startzeiten eines Blocks – unter Berücksichtigung
 * der bereits belegten Zeiten. Nach jeder Buchung erneut aufrufen, dann
 * schrumpft die Liste automatisch (Live-Berechnung, nicht statisch).
 */
export function validStartTimes(
  cfg: BlockConfig,
  occupied: Interval[] = [],
  /** Puffer des anfragenden Schülers (Fahrzeit, aufgerundet). */
  candidateBuffer?: number
): Minutes[] {
  const grid = cfg.gridMinutes ?? DEFAULT_GRID_MINUTES;
  const result: Minutes[] = [];
  for (
    let s = cfg.block.start;
    s + cfg.lessonMinutes <= cfg.block.end;
    s += grid
  ) {
    if (isValidStart(s, cfg, occupied, candidateBuffer)) result.push(s);
  }
  return result;
}

/**
 * Wie viele Lektionen passen theoretisch noch in den Block?
 * Nützlich für Admin-Auswertungen ("wie viel Kapazität ist offen").
 */
export function remainingCapacity(
  cfg: BlockConfig,
  occupied: Interval[] = [],
  /** Puffer, mit dem hypothetische Folgelektionen gerechnet werden. */
  assumedBuffer?: number
): number {
  const { lessonMinutes, block } = cfg;
  const bufferMinutes = assumedBuffer ?? cfg.bufferMinutes;
  const busy = normalize(occupied).filter(
    (b) => b.end > block.start && b.start < block.end
  );

  // Freie Abschnitte zwischen den Belegungen ermitteln.
  const free: Interval[] = [];
  let cursor = block.start;
  for (const b of busy) {
    if (b.start > cursor) free.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < block.end) free.push({ start: cursor, end: block.end });

  let total = 0;
  for (const seg of free) {
    // Grenzt der Abschnitt an eine Belegung, geht dort Puffer verloren.
    // An den Blockrändern ist kein Puffer nötig.
    // An eine Belegung angrenzend gilt der grössere der beiden Puffer.
    const leftNeighbour = busy.filter((b) => b.end === seg.start).pop();
    const rightNeighbour = busy.find((b) => b.start === seg.end);
    const bufferLeft =
      seg.start > block.start
        ? gapBetween(leftNeighbour?.bufferMinutes, bufferMinutes, bufferMinutes)
        : 0;
    const bufferRight =
      seg.end < block.end
        ? gapBetween(rightNeighbour?.bufferMinutes, bufferMinutes, bufferMinutes)
        : 0;
    const usable = seg.end - seg.start - bufferLeft - bufferRight;
    if (usable < lessonMinutes) continue;
    // n Lektionen belegen n*L + (n-1)*B
    total += Math.floor((usable + bufferMinutes) / (lessonMinutes + bufferMinutes));
  }
  return total;
}
