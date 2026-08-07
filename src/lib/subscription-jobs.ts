/**
 * Abo-Automatik.
 *
 * Läuft im bestehenden 5-Minuten-Cron mit und erledigt vier Dinge:
 *  1. Fällige Raten in Rechnung stellen.
 *  2. Nicht bezahlte Raten nach Ablauf der Zahlungsfrist als überfällig markieren.
 *  3. Vorwarnung verschicken, bevor sich ein Abo automatisch verlängert.
 *  4. Abgelaufene Abos verlängern (auto_renew) bzw. verfallen lassen.
 *
 * Alles ist idempotent: Raten mit Rechnung werden übersprungen, Vorwarnungen
 * über `renewal_notice_sent_at` einmalig gehalten, und der partielle
 * Unique-Index `packages_one_active_per_student` verhindert doppelte
 * Verlängerungen selbst bei parallelen Läufen.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  INSTALMENT_DUE_DAYS,
  createInstalmentSchedule,
  issueInstalmentInvoice,
} from "@/lib/package-invoice";
import { PACKAGE_LABELS, PACKAGE_LESSONS } from "@/lib/packages";
import {
  RENEWAL_NOTICE_DAYS,
  buildInstalmentPlan,
  SUBSCRIPTION_TERM_MONTHS,
  addMonths,
  todayInZurich,
  type SubscriptionType,
} from "@/lib/subscription";

export type SubscriptionJobResult = {
  instalmentsInvoiced: number;
  instalmentsOverdue: number;
  renewalNotices: number;
  renewed: number;
  expired: number;
};

type ProfileRow = {
  vorname: string | null;
  nachname: string | null;
  adresse: string | null;
  email: string | null;
  payment_method: string | null;
};

/** Ein Paket, so wie der Job es braucht. */
type PackageJobRow = {
  id: string;
  student_id: string;
  type: string;
  total_price: number | string | null;
  price_per_lesson: number | string | null;
  payment_method: string | null;
  lessons_total: number | null;
  lessons_used: number | null;
  expires_at: string | null;
  auto_renew: boolean | null;
  billing_mode: string | null;
  term_months: number | null;
  instalment_count: number | null;
  renewal_notice_sent_at: string | null;
  status: string;
};

type InstalmentJobRow = {
  id: string;
  package_id: string;
  student_id: string;
  sequence: number;
  kind: string;
  amount: number | string;
  due_date: string;
  invoice_id: string | null;
};

const PROFILE_FIELDS = "vorname, nachname, adresse, email, payment_method";
const PACKAGE_FIELDS =
  "id, student_id, type, total_price, price_per_lesson, payment_method, lessons_total, lessons_used, expires_at, auto_renew, billing_mode, term_months, instalment_count, renewal_notice_sent_at, status";

/** Outbox-Eintrag, idempotent über `dedupe_key`. */
async function enqueueOnce(
  admin: SupabaseClient,
  type: string,
  payload: Record<string, unknown>,
  dedupeKey: string
): Promise<boolean> {
  const { error } = await admin.from("scheduled_emails").insert({
    type,
    payload,
    send_at: new Date().toISOString(),
    status: "pending",
    dedupe_key: dedupeKey,
  });
  if (error) {
    if (error.code === "23505") return false;
    console.error("[abo] enqueue fehlgeschlagen:", type, error.message);
    return false;
  }
  return true;
}

function isoDayFromTimestamp(ts: string): string {
  return todayInZurich(new Date(ts));
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(
    dt.getUTCDate()
  )}`;
}

// ── 1. Fällige Raten fakturieren ────────────────────────────────────

async function invoiceDueInstalments(
  admin: SupabaseClient,
  today: string
): Promise<number> {
  const { data: due } = await admin
    .from("package_instalments")
    .select("id, package_id, student_id, sequence, kind, amount, due_date, invoice_id")
    .eq("status", "open")
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .limit(50)
    .overrideTypes<InstalmentJobRow[]>();

  if (!due?.length) return 0;

  let count = 0;
  for (const inst of due) {
    if (inst.invoice_id) continue;

    const { data: pkg } = await admin
      .from("packages")
      .select(PACKAGE_FIELDS)
      .eq("id", inst.package_id)
      .maybeSingle<PackageJobRow>();
    if (!pkg || pkg.status === "cancelled") continue;

    const { data: profile } = await admin
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("id", inst.student_id)
      .maybeSingle<ProfileRow>();
    if (!profile) continue;

    const result = await issueInstalmentInvoice(
      admin,
      inst,
      { ...pkg, instalment_count: pkg.instalment_count },
      profile
    );
    if ("invoiceId" in result) count++;
  }
  return count;
}

// ── 2. Überfällige Raten markieren ──────────────────────────────────

async function markOverdueInstalments(
  admin: SupabaseClient,
  today: string
): Promise<number> {
  // Zahlungsfrist ab Stichtag: due_date + INSTALMENT_DUE_DAYS.
  const cutoff = addDaysIso(today, -INSTALMENT_DUE_DAYS);

  const { data, error } = await admin
    .from("package_instalments")
    .update({ status: "overdue" })
    .in("status", ["open", "invoiced"])
    .lt("due_date", cutoff)
    .select("id");

  if (error) {
    console.error("[abo] Überfällig-Markierung fehlgeschlagen:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

// ── 3. Vorwarnung vor der Verlängerung ──────────────────────────────

async function sendRenewalNotices(
  admin: SupabaseClient,
  now: Date
): Promise<number> {
  const until = new Date(now.getTime() + RENEWAL_NOTICE_DAYS * 86400000);

  const { data: packages } = await admin
    .from("packages")
    .select(PACKAGE_FIELDS)
    .eq("status", "active")
    .eq("auto_renew", true)
    .is("renewal_notice_sent_at", null)
    .not("expires_at", "is", null)
    .gt("expires_at", now.toISOString())
    .lt("expires_at", until.toISOString())
    .limit(100)
    .overrideTypes<PackageJobRow[]>();

  let count = 0;
  for (const pkg of packages ?? []) {
    const created = await enqueueOnce(
      admin,
      "subscription_renewal_notice",
      {
        student_id: pkg.student_id,
        package_id: pkg.id,
        package_label: PACKAGE_LABELS[pkg.type] ?? pkg.type,
        expires_at: pkg.expires_at,
        lessons_remaining: Math.max(
          0,
          Number(pkg.lessons_total ?? 0) - Number(pkg.lessons_used ?? 0)
        ),
      },
      `subscription_renewal_notice:${pkg.id}`
    );
    await admin
      .from("packages")
      .update({ renewal_notice_sent_at: new Date().toISOString() })
      .eq("id", pkg.id);
    if (created) count++;
  }
  return count;
}

// ── 4. Abgelaufene Abos: verlängern oder verfallen lassen ───────────

async function processExpiredPackages(
  admin: SupabaseClient,
  now: Date
): Promise<{ renewed: number; expired: number }> {
  const { data: packages } = await admin
    .from("packages")
    .select(PACKAGE_FIELDS)
    .eq("status", "active")
    .not("expires_at", "is", null)
    .lte("expires_at", now.toISOString())
    .limit(50)
    .overrideTypes<PackageJobRow[]>();

  let renewed = 0;
  let expired = 0;

  for (const pkg of packages ?? []) {
    const remaining = Math.max(
      0,
      Number(pkg.lessons_total ?? 0) - Number(pkg.lessons_used ?? 0)
    );

    // Altes Paket schliessen – zuerst, damit der Unique-Index
    // `packages_one_active_per_student` das Folgepaket nicht blockiert.
    const { error: closeErr } = await admin
      .from("packages")
      .update({ status: "expired" })
      .eq("id", pkg.id)
      .eq("status", "active");

    if (closeErr) {
      console.error("[abo] Ablauf fehlgeschlagen:", pkg.id, closeErr.message);
      continue;
    }
    expired++;

    // Nicht genutzte Lektionen verfallen – darüber wird informiert.
    if (remaining > 0) {
      await enqueueOnce(
        admin,
        "subscription_expired",
        {
          student_id: pkg.student_id,
          package_id: pkg.id,
          package_label: PACKAGE_LABELS[pkg.type] ?? pkg.type,
          lessons_forfeited: remaining,
          expires_at: pkg.expires_at,
        },
        `subscription_expired:${pkg.id}`
      );
    }

    if (!pkg.auto_renew) continue;

    // ── Verlängerung ──
    const type = pkg.type as SubscriptionType;
    if (type !== "10er" && type !== "20er") continue;

    const { data: profile } = await admin
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("id", pkg.student_id)
      .maybeSingle<ProfileRow>();
    if (!profile) continue;

    const termMonths = SUBSCRIPTION_TERM_MONTHS[type];
    const startDay = todayInZurich(now);
    const lessonsTotal = PACKAGE_LESSONS[type];
    const ppl = Number(pkg.price_per_lesson ?? 0);
    const totalPrice = Number(pkg.total_price ?? ppl * lessonsTotal);
    const expiresOn = addMonths(startDay, termMonths);

    // Ratenplan schon hier berechnen: die Check-Constraint
    // `packages_raten_complete_check` verlangt, dass ein Ratenpaket
    // Anzahlung, Ratenanzahl und Ratenhöhe bereits beim Insert mitbringt.
    // buildInstalmentPlan ist deterministisch, createInstalmentSchedule
    // unten erzeugt daher exakt denselben Plan.
    const renewalPlan =
      pkg.billing_mode === "raten"
        ? buildInstalmentPlan(type, totalPrice, startDay)
        : null;

    const { data: next, error: insErr } = await admin
      .from("packages")
      .insert({
        student_id: pkg.student_id,
        type,
        lessons_total: lessonsTotal,
        lessons_used: 0,
        name: PACKAGE_LABELS[type],
        price_per_lesson: ppl,
        total_price: totalPrice,
        starts_at: now.toISOString(),
        expires_at: `${expiresOn}T12:00:00.000Z`,
        status: "active",
        billing_mode: pkg.billing_mode,
        term_months: termMonths,
        auto_renew: true,
        renewed_from_package_id: pkg.id,
        deposit_amount: renewalPlan ? renewalPlan.depositAmount : null,
        instalment_count: renewalPlan ? renewalPlan.instalmentCount : null,
        instalment_amount: renewalPlan ? renewalPlan.instalmentAmount : null,
      })
      .select(PACKAGE_FIELDS)
      .maybeSingle<PackageJobRow>();

    if (insErr || !next) {
      // 23505 = es existiert bereits ein aktives Paket (paralleler Lauf).
      if (insErr?.code !== "23505") {
        console.error("[abo] Verlängerung fehlgeschlagen:", pkg.id, insErr?.message);
      }
      continue;
    }

    if (renewalPlan) {
      const result = await createInstalmentSchedule(admin, next, profile, {
        type,
        totalPrice,
        startDate: startDay,
      });
      if ("error" in result) {
        console.error("[abo] Ratenplan der Verlängerung:", next.id, result.error);
      }
    } else {
      const { createPackageInvoice } = await import("@/lib/package-invoice");
      await createPackageInvoice(admin, next, profile);
    }

    await enqueueOnce(
      admin,
      "subscription_renewed",
      {
        student_id: pkg.student_id,
        package_id: next.id,
        previous_package_id: pkg.id,
        package_label: PACKAGE_LABELS[type],
        total_price: totalPrice,
        billing_mode: pkg.billing_mode,
        expires_at: next.expires_at,
      },
      `subscription_renewed:${next.id}`
    );

    await enqueueOnce(
      admin,
      "subscription_renewed_admin",
      {
        student_id: pkg.student_id,
        student_name:
          `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim() || undefined,
        package_id: next.id,
        package_label: PACKAGE_LABELS[type],
        billing_mode: pkg.billing_mode,
        expires_at: next.expires_at,
      },
      `subscription_renewed_admin:${next.id}`
    );

    renewed++;
  }

  return { renewed, expired };
}

// ── Einstiegspunkt ──────────────────────────────────────────────────

export async function runSubscriptionJobs(
  admin: SupabaseClient
): Promise<SubscriptionJobResult> {
  const now = new Date();
  const today = todayInZurich(now);

  const result: SubscriptionJobResult = {
    instalmentsInvoiced: 0,
    instalmentsOverdue: 0,
    renewalNotices: 0,
    renewed: 0,
    expired: 0,
  };

  try {
    result.instalmentsInvoiced = await invoiceDueInstalments(admin, today);
  } catch (err) {
    console.error("[abo] Ratenfakturierung fehlgeschlagen:", err);
  }

  try {
    result.instalmentsOverdue = await markOverdueInstalments(admin, today);
  } catch (err) {
    console.error("[abo] Überfällig-Prüfung fehlgeschlagen:", err);
  }

  try {
    result.renewalNotices = await sendRenewalNotices(admin, now);
  } catch (err) {
    console.error("[abo] Vorwarnung fehlgeschlagen:", err);
  }

  try {
    const { renewed, expired } = await processExpiredPackages(admin, now);
    result.renewed = renewed;
    result.expired = expired;
  } catch (err) {
    console.error("[abo] Ablauf/Verlängerung fehlgeschlagen:", err);
  }

  return result;
}

export { isoDayFromTimestamp, addDaysIso };
