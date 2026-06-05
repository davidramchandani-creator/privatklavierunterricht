// ============================================================
// Gruppenkurs-Domänenlogik (Meilenstein „Gruppenkurse")
// Preis pro Person (dynamisch nach Teilnehmerzahl, pro Kurs frei
// einstellbar) und Lektionsdauer (45 Min bei 1–2, 90 Min ab 3).
// ============================================================

export type GroupCourse = {
  id: string;
  title: string;
  description: string | null;
  max_participants: number;
  /** Map Teilnehmerzahl→Preis pro Person pro Lektion, z.B. {"1":70,"2":55,"3":45}. */
  price_tiers: Record<string, number>;
  long_duration_from: number;
  short_minutes: number;
  long_minutes: number;
  status: string;
  erstellt_am: string;
  aktualisiert_am: string;
};

export type GroupSession = {
  id: string;
  course_id: string;
  start_at: string;
  end_at: string;
  status: string; // open | full | cancelled | completed
  created_by: string | null;
  erstellt_am: string;
  aktualisiert_am: string;
};

/**
 * Preis pro Person pro Lektion für eine gegebene Teilnehmerzahl.
 * Nimmt den höchsten definierten Tier-Schlüssel ≤ count (z.B. bei
 * {"1":70,"2":55,"3":45} und count=4 → 45). Unter dem kleinsten Schlüssel
 * gilt der kleinste Tier. Ohne Tiers → 0.
 */
export function pricePerPersonFor(
  course: Pick<GroupCourse, "price_tiers">,
  participantCount: number
): number {
  const tiers = Object.entries(course.price_tiers ?? {})
    .map(([k, v]) => [Number(k), Number(v)] as const)
    .filter(([k, v]) => Number.isFinite(k) && Number.isFinite(v))
    .sort((a, b) => a[0] - b[0]);
  if (tiers.length === 0) return 0;
  let price = tiers[0][1];
  for (const [count, p] of tiers) {
    if (participantCount >= count) price = p;
  }
  return price;
}

/** Lektionsdauer (Min.) für eine Teilnehmerzahl (ab `long_duration_from` → lang). */
export function durationMinFor(
  course: Pick<GroupCourse, "long_duration_from" | "short_minutes" | "long_minutes">,
  participantCount: number
): number {
  return participantCount >= course.long_duration_from
    ? course.long_minutes
    : course.short_minutes;
}

/** Ist die Session bei dieser Teilnehmerzahl voll? */
export function isSessionFull(
  course: Pick<GroupCourse, "max_participants">,
  participantCount: number
): boolean {
  return participantCount >= course.max_participants;
}

/**
 * Validiert/normalisiert eine Preis-Tier-Map aus dem Admin-Editor.
 * Schlüssel = positive Ganzzahlen (Teilnehmerzahl), Werte = Preis ≥ 0.
 * Gibt eine bereinigte Map zurück (ungültige Einträge entfernt).
 */
export function normalizePriceTiers(
  raw: Record<string, unknown>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    const count = Number(k);
    const price = Number(v);
    if (Number.isInteger(count) && count >= 1 && Number.isFinite(price) && price >= 0) {
      out[String(count)] = price;
    }
  }
  return out;
}
