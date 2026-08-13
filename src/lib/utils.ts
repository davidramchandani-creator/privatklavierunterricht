import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCHF(amount: number): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Alle Datums-/Zeit-Ausgaben laufen über `Europe/Zurich`, unabhängig davon,
 * in welcher Zeitzone der Server läuft (Vercel = UTC). Ohne diese feste Zone
 * zeigte das Admin-Portal UTC-Zeiten (z. B. 17:00) und das Schülerportal die
 * korrekte Lokalzeit (19:00), derselbe Termin sah unterschiedlich aus.
 */
export const APP_TIMEZONE = "Europe/Zurich";

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Kalenderdatum (YYYY-MM-DD) eines Instants in `Europe/Zurich`. */
export function zurichDateKey(date: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

/** Stunde (0–23) eines Instants in `Europe/Zurich`. */
export function zurichHour(date: string | Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: APP_TIMEZONE,
      hour: "2-digit",
      hour12: false,
    }).format(new Date(date))
      // "24" → "00" bei manchen Engines abfangen
      .replace(/^24/, "00")
  );
}

/** Offset (ms) von Europe/Zurich gegenüber UTC zum gegebenen Instant. */
function zurichOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const m: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = Number(p.value);
  const asUTC = Date.UTC(
    m.year,
    m.month - 1,
    m.day,
    m.hour === 24 ? 0 : m.hour,
    m.minute,
    m.second
  );
  return asUTC - instant.getTime();
}

/**
 * Wandelt eine Zürcher Wandzeit (Datum + Uhrzeit) in einen UTC-ISO-Instant um.
 * DST-sicher (berücksichtigt Sommer-/Winterzeit-Übergänge).
 * @param dateStr "YYYY-MM-DD"
 * @param timeStr "HH:MM"
 */
export function zurichLocalToIso(dateStr: string, timeStr: string): string | null {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  if (!y || !mo || !d || hh == null || mm == null || isNaN(hh) || isNaN(mm)) {
    return null;
  }
  const utcGuess = Date.UTC(y, mo - 1, d, hh, mm);
  const offset1 = zurichOffsetMs(new Date(utcGuess));
  let instant = utcGuess - offset1;
  // Einmal verfeinern für DST-Grenzfälle.
  const offset2 = zurichOffsetMs(new Date(instant));
  if (offset2 !== offset1) instant = utcGuess - offset2;
  return new Date(instant).toISOString();
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function isWithin24Hours(date: string | Date): boolean {
  const targetDate = new Date(date);
  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  return diffMs < 24 * 60 * 60 * 1000;
}
