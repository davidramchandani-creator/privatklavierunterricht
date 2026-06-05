// Geteilte Helfer für die Wochen-Slot-Gitter (Einzel- und Gruppen-Buchung).
// Alle Datumsschlüssel in Zürcher Lokalzeit (DST-sicher).

export type WeekDay = { dateStr: string; label: string };

export function getMonday(weekOffset: number): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Zürcher Kalenderdatum (YYYY-MM-DD) eines Instants – DST-sicher. */
export function zurichDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function getDaysInWeek(weekOffset: number): WeekDay[] {
  const monday = getMonday(weekOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * 86400000);
    return {
      dateStr: zurichDateKey(d),
      label: d.toLocaleDateString("de-CH", { timeZone: "Europe/Zurich", weekday: "short" }),
    };
  });
}

export function weekLabel(weekOffset: number): string {
  const monday = getMonday(weekOffset);
  const friday = new Date(monday.getTime() + 4 * 86400000);
  return `${monday.toLocaleDateString("de-CH", { day: "numeric", month: "long" })} – ${friday.toLocaleDateString(
    "de-CH",
    { day: "numeric", month: "long", year: "numeric" }
  )}`;
}

/** Gruppiert Slots (alles mit `beginn`-ISO) nach Zürcher Datum. */
export function groupSlotsByDay<T extends { beginn: string }>(
  slots: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const slot of slots) {
    const dateStr = zurichDateKey(new Date(slot.beginn));
    if (!map.has(dateStr)) map.set(dateStr, []);
    map.get(dateStr)!.push(slot);
  }
  return map;
}

export function fmtSlotLong(iso: string): string {
  return (
    new Date(iso).toLocaleDateString("de-CH", {
      timeZone: "Europe/Zurich",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }) + " Uhr"
  );
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  });
}
