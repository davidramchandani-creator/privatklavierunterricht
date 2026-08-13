// ============================================================
// Abo-Modell: Laufzeit, Anzahlung, Ratenplan, Verlängerung
// Reine Funktionen ohne DB- oder UI-Abhängigkeit.
// ============================================================

export type SubscriptionType = "10er" | "20er";

/**
 * Laufzeit = Gültigkeit des Pakets UND Ratenlaufzeit (Entscheid Dave).
 *
 * Diese Werte gelten für den **wöchentlichen** Rhythmus. Bei zweiwöchentlichem
 * Unterricht ist die Laufzeit länger, die Berechnung dazu steht in
 * `rhythmus.ts` (`termMonthsForType`) und wird hier über die Optionen von
 * `buildInstalmentPlan` hereingereicht. Hier bleiben sie als Default stehen,
 * damit Altcode und Vorschauen ohne Rhythmus weiter funktionieren.
 */
export const SUBSCRIPTION_TERM_MONTHS: Record<SubscriptionType, number> = {
  "10er": 4,
  "20er": 8,
};

/** Anzahl Monatsraten nach der Anzahlung (wöchentlicher Rhythmus). */
export const SUBSCRIPTION_INSTALMENTS: Record<SubscriptionType, number> = {
  "10er": 4,
  "20er": 8,
};

/** Anzahlung in Prozent des Gesamtpreises. */
export const DEPOSIT_RATE = 0.25;

/** Kündigungsfrist vor Ablauf der Laufzeit (Tage). */
export const CANCELLATION_NOTICE_DAYS = 14;

/** Vorwarnung, bevor die Auto-Verlängerung ausgelöst wird (Tage vor Ablauf). */
export const RENEWAL_NOTICE_DAYS = 30;

export type InstalmentKind = "anzahlung" | "rate";

export type PlannedInstalment = {
  sequence: number;
  kind: InstalmentKind;
  amount: number;
  /** ISO-Datum YYYY-MM-DD */
  dueDate: string;
};

export type InstalmentPlan = {
  totalPrice: number;
  termMonths: number;
  depositAmount: number;
  instalmentCount: number;
  /** Nennbetrag einer Rate; die letzte Rate kann abweichen (Rundungsrest). */
  instalmentAmount: number;
  entries: PlannedInstalment[];
  /** ISO-Datum, an dem das Paket verfällt. */
  expiresOn: string;
};

/** Auf 5 Rappen runden (Schweizer Rundung). */
export function roundRappen(value: number): number {
  return Math.round(value * 20) / 20;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Datum um n Monate verschieben. Läuft der Kalendertag über das Monatsende
 * hinaus (31. Januar + 1 Monat), wird auf den letzten Tag des Zielmonats
 * geklemmt, nie in den Folgemonat gerutscht.
 */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + months;
  const ty = Math.floor(total / 12);
  const tm = (total % 12) + 1;
  const td = Math.min(d, daysInMonth(ty, tm));
  return toIso(ty, tm, td);
}

/** Durchschnittliche Tage pro Monat, für gebrochene Laufzeiten. */
const DAYS_PER_MONTH = 30.44;

/**
 * Datum um eine (auch gebrochene) Anzahl Monate verschieben.
 *
 * Ganze Monate laufen über `addMonths` (monatsende-sicher), der Rest wird in
 * Tagen ergänzt. Gebrochene Laufzeiten entstehen beim Rhythmuswechsel: mit
 * 7 Restlektionen zweiwöchentlich sind es 4.2 Monate, das gibt es als
 * Kalendermonat nicht.
 */
export function addTermMonths(isoDate: string, months: number): string {
  const whole = Math.trunc(months);
  const rest = months - whole;
  const base = addMonths(isoDate, whole);
  const extraDays = Math.round(rest * DAYS_PER_MONTH);
  if (extraDays === 0) return base;
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + extraDays * 86400000);
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export type InstalmentPlanOptions = {
  /**
   * Laufzeit in Monaten. Ohne Angabe gilt der wöchentliche Standard des
   * Pakettyps. Der Rhythmus-abhängige Wert kommt aus `termMonthsForType`.
   */
  termMonths?: number;
  /**
   * Anzahl Monatsraten nach der Anzahlung. Ohne Angabe: eine Rate pro
   * angefangenem Laufzeitmonat.
   */
  instalmentCount?: number;
};

/**
 * Ratenplan für ein Abo.
 *
 * Anzahlung (25 %) ist sofort fällig, danach folgen `instalmentCount`
 * gleich hohe Monatsraten. Die letzte Rate nimmt den Rundungsrest auf,
 * damit die Summe exakt dem Gesamtpreis entspricht.
 *
 * Bei zweiwöchentlichem Rhythmus ist die Laufzeit länger, also gibt es mehr
 * und dafür kleinere Raten. Der Gesamtpreis bleibt identisch, der Rhythmus
 * ändert nur, über welchen Zeitraum bezahlt wird, nie wie viel.
 */
export function buildInstalmentPlan(
  type: SubscriptionType,
  totalPrice: number,
  startDate: string,
  options: InstalmentPlanOptions = {}
): InstalmentPlan {
  const termMonths = options.termMonths ?? SUBSCRIPTION_TERM_MONTHS[type];
  const instalmentCount = Math.max(
    1,
    options.instalmentCount ?? Math.round(termMonths)
  );

  const total = roundRappen(totalPrice);
  const deposit = roundRappen(total * DEPOSIT_RATE);
  const rest = roundRappen(total - deposit);
  const nominal = roundRappen(rest / instalmentCount);

  const entries: PlannedInstalment[] = [
    { sequence: 0, kind: "anzahlung", amount: deposit, dueDate: startDate },
  ];

  let assigned = 0;
  for (let i = 1; i <= instalmentCount; i++) {
    const isLast = i === instalmentCount;
    const amount = isLast ? roundRappen(rest - assigned) : nominal;
    assigned = roundRappen(assigned + amount);
    entries.push({
      sequence: i,
      kind: "rate",
      amount,
      dueDate: addMonths(startDate, i),
    });
  }

  return {
    totalPrice: total,
    termMonths,
    depositAmount: deposit,
    instalmentCount,
    instalmentAmount: nominal,
    entries,
    expiresOn: addTermMonths(startDate, termMonths),
  };
}

/** Summe aller geplanten Beträge, muss exakt dem Gesamtpreis entsprechen. */
export function planTotal(plan: InstalmentPlan): number {
  return roundRappen(plan.entries.reduce((sum, e) => sum + e.amount, 0));
}

/**
 * Letzter Tag, an dem noch fristgerecht gekündigt werden kann.
 * Danach verlängert sich das Abo automatisch (sofern auto_renew aktiv).
 */
export function cancellationDeadline(expiresOn: string): string {
  const [y, m, d] = expiresOn.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) - CANCELLATION_NOTICE_DAYS * 86400000;
  const dt = new Date(t);
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function isCancellable(expiresOn: string, today: string): boolean {
  return today <= cancellationDeadline(expiresOn);
}

/** Tagesdatum in Europe/Zurich als YYYY-MM-DD. */
export function todayInZurich(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}
