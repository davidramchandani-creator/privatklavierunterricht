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
 * korrekte Lokalzeit (19:00) – derselbe Termin sah unterschiedlich aus.
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
