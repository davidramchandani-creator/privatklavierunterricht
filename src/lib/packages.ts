// ============================================================
// Paket-Domänenlogik (Meilenstein 3)
// Status, Timer-Berechnung, Preise, Gültigkeit
// ============================================================

export type PackageType = "single" | "10er" | "20er";

export type Package = {
  id: string;
  student_id: string;
  type: string;
  lessons_total: number;
  lessons_used: number;
  name: string | null;
  price_per_lesson: number;
  total_price: number | null;
  payment_method: string | null;
  starts_at: string | null;
  expires_at: string | null;
  status: string;
  paused: boolean;
  pause_remaining_seconds: number | null;
  paused_at: string | null;
  erstellt_am: string;
};

export const PACKAGE_LABELS: Record<string, string> = {
  single: "Einzellektion",
  "10er": "10er-Paket",
  "20er": "20er-Paket",
};

// Gültigkeitsdauer ab starts_at = Abo-Laufzeit: 10er = 4 Monate, 20er = 8 Monate.
// Identisch mit SUBSCRIPTION_TERM_MONTHS in subscription.ts (Entscheid Dave:
// Gültigkeit und Ratenlaufzeit laufen synchron ab).
export const PACKAGE_VALIDITY_MONTHS: Record<string, number | null> = {
  single: null,
  "10er": 4,
  "20er": 8,
};

export const PACKAGE_LESSONS: Record<string, number> = {
  single: 1,
  "10er": 10,
  "20er": 20,
};

export type EffectiveStatus =
  | "kein_paket"
  | "aktiv"
  | "pausiert"
  | "aufgebraucht"
  | "abgelaufen"
  | "storniert";

export type PackageState = {
  lessonsTotal: number;
  lessonsUsed: number;
  lessonsRemaining: number;
  progressPercent: number;
  isExpired: boolean;
  isExhausted: boolean;
  isPaused: boolean;
  isActive: boolean; // tatsächlich nutzbar (aktiv, nicht pausiert/abgelaufen/aufgebraucht)
  remainingMs: number | null; // Zeit bis Ablauf (bzw. Restzeit bei Pause)
  effectiveStatus: EffectiveStatus;
};

/**
 * Berechnet den effektiven Zustand eines Pakets.
 * `lessonsUsedOverride` erlaubt es, die genutzten Lektionen aus der
 * tatsächlichen Anzahl gebuchter Appointments zu übergeben (Spec §3).
 */
export function computePackageState(
  pkg: Package | null,
  lessonsUsedOverride?: number
): PackageState {
  if (!pkg) {
    return {
      lessonsTotal: 0,
      lessonsUsed: 0,
      lessonsRemaining: 0,
      progressPercent: 0,
      isExpired: false,
      isExhausted: false,
      isPaused: false,
      isActive: false,
      remainingMs: null,
      effectiveStatus: "kein_paket",
    };
  }

  const lessonsUsed = lessonsUsedOverride ?? pkg.lessons_used;
  const lessonsTotal = pkg.lessons_total;
  const lessonsRemaining = Math.max(0, lessonsTotal - lessonsUsed);
  const progressPercent =
    lessonsTotal > 0 ? Math.min(100, (lessonsUsed / lessonsTotal) * 100) : 0;

  const now = Date.now();
  const isPaused = pkg.paused;
  const isExhausted = lessonsRemaining <= 0 || pkg.status === "exhausted";

  let remainingMs: number | null = null;
  let isExpired = pkg.status === "expired";

  if (isPaused && pkg.pause_remaining_seconds != null) {
    // Bei Pause zählt die eingefrorene Restzeit
    remainingMs = pkg.pause_remaining_seconds * 1000;
  } else if (pkg.expires_at) {
    remainingMs = new Date(pkg.expires_at).getTime() - now;
    if (remainingMs <= 0) isExpired = true;
  }

  let effectiveStatus: EffectiveStatus;
  if (pkg.status === "cancelled") effectiveStatus = "storniert";
  else if (isExpired) effectiveStatus = "abgelaufen";
  else if (isExhausted) effectiveStatus = "aufgebraucht";
  else if (isPaused) effectiveStatus = "pausiert";
  else effectiveStatus = "aktiv";

  return {
    lessonsTotal,
    lessonsUsed,
    lessonsRemaining,
    progressPercent,
    isExpired,
    isExhausted,
    isPaused,
    isActive: effectiveStatus === "aktiv",
    remainingMs,
    effectiveStatus,
  };
}

/**
 * Neues Paket nur buchbar, wenn kein nutzbares Paket vorhanden ist
 * (aufgebraucht, abgelaufen, storniert oder gar keins). Spec §5.
 */
export function canBuyNewPackage(pkg: Package | null): boolean {
  if (!pkg) return true;
  const s = computePackageState(pkg);
  return (
    s.effectiveStatus === "aufgebraucht" ||
    s.effectiveStatus === "abgelaufen" ||
    s.effectiveStatus === "storniert"
  );
}

/** Menschenfreundliche Restlaufzeit, z.B. "3 Monaten", "12 Tagen". */
export function formatRemainingTime(ms: number | null): string {
  if (ms == null) return "unbegrenzt";
  if (ms <= 0) return "abgelaufen";

  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);

  if (months >= 2) return `${months} Monaten`;
  if (days >= 1) return `${days} ${days === 1 ? "Tag" : "Tagen"}`;
  if (hours >= 1) return `${hours} ${hours === 1 ? "Stunde" : "Stunden"}`;
  return `${minutes} ${minutes === 1 ? "Minute" : "Minuten"}`;
}

// ============================================================
// Paket-Stornierung (Meilenstein 10)
// ============================================================

/** Stornierung nur bis einschliesslich der so vielten genutzten Lektion. */
export const MAX_USED_LESSONS_FOR_CANCELLATION = 3;
/** Basis-Einzelpreis bei Stornierung (Spec §10). */
export const CANCELLATION_SINGLE_BASE = 70;
/** Schwelle, ab der der Paket-Lektionspreis den Einzelpreis erhöht. */
export const CANCELLATION_SINGLE_THRESHOLD = 60;

/**
 * Effektiver Einzelpreis je bereits genutzter Lektion bei Stornierung:
 * 70 + max(0, Paket-Lektionspreis − 60). Damit wird der vergünstigte
 * Paketpreis für die tatsächlich besuchten Lektionen auf Einzelpreis-Niveau
 * nachberechnet (Spec §10).
 */
export function cancellationSingleLessonPrice(pricePerLesson: number): number {
  return (
    CANCELLATION_SINGLE_BASE +
    Math.max(0, Number(pricePerLesson) - CANCELLATION_SINGLE_THRESHOLD)
  );
}

export type CancellationSettlement = {
  lessonsUsed: number;
  singleLessonPrice: number;
  usedCost: number; // genutzte Lektionen × Einzelpreis
  paidTotal: number; // ursprünglich bezahlter Paketpreis
  refund: number; // Rückerstattung (nie negativ)
  owed: number; // Nachzahlung, falls usedCost > paidTotal
};

/**
 * Berechnet die finanzielle Abrechnung einer Paket-Stornierung.
 * Die bereits genutzten Lektionen werden zum Einzelpreis verrechnet; die
 * Differenz zum bezahlten Paketpreis ergibt die Rückerstattung (bzw. eine
 * Nachzahlung, falls die genutzten Lektionen teurer sind als das Paket).
 */
export function computeCancellationSettlement(
  pkg: Package,
  lessonsUsed: number
): CancellationSettlement {
  const singleLessonPrice = cancellationSingleLessonPrice(
    Number(pkg.price_per_lesson)
  );
  const usedCost = lessonsUsed * singleLessonPrice;
  const paidTotal =
    pkg.total_price != null
      ? Number(pkg.total_price)
      : pkg.lessons_total * Number(pkg.price_per_lesson);
  const diff = paidTotal - usedCost;
  return {
    lessonsUsed,
    singleLessonPrice,
    usedCost,
    paidTotal,
    refund: Math.max(0, diff),
    owed: Math.max(0, -diff),
  };
}

/**
 * Ob ein Paket noch stornierbar ist: nur aktive/pausierte Pakete und nur,
 * solange höchstens MAX_USED_LESSONS_FOR_CANCELLATION Lektionen genutzt wurden.
 */
export function canCancelPackage(
  pkg: Package | null,
  lessonsUsed: number
): boolean {
  if (!pkg) return false;
  if (pkg.status === "cancelled") return false;
  const state = computePackageState(pkg, lessonsUsed);
  if (state.effectiveStatus !== "aktiv" && state.effectiveStatus !== "pausiert") {
    return false;
  }
  return lessonsUsed <= MAX_USED_LESSONS_FOR_CANCELLATION;
}

/** Preis pro Lektion für einen Pakettyp inkl. Wegaufschlag. */
export function pricePerLessonFor(
  type: PackageType,
  prices: { price_single: number; price_10er: number; price_20er: number; travel_surcharge: number }
): number {
  const base =
    type === "single"
      ? prices.price_single
      : type === "10er"
      ? prices.price_10er
      : prices.price_20er;
  return Number(base) + Number(prices.travel_surcharge);
}
