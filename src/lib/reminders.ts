/**
 * Erinnerungen (Reminder).
 *
 * Zwei Wege, wie Erinnerungen in die Outbox (`scheduled_emails`) kommen:
 *  1. Beim Buchen eines Termins → 24h- und 2h-Reminder direkt einplanen.
 *  2. Periodischer Scan (Cron) → überfällige Zahlungen und ablaufende Pakete.
 *
 * Alles ist über `dedupe_key` idempotent: Ein erneuter Scan legt keine
 * Duplikate an, weil auf der Spalte ein UNIQUE-Index liegt.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Tage vor Ablauf, ab denen auf ein auslaufendes Paket hingewiesen wird. */
export const PACKAGE_EXPIRY_WARN_DAYS = 14;

type EnqueueArgs = {
  type: string;
  payload: Record<string, unknown>;
  sendAt: Date;
  dedupeKey: string;
};

/**
 * Legt einen Outbox-Eintrag an, sofern es ihn noch nicht gibt.
 * Verstösse gegen den UNIQUE-Index (23505) werden bewusst verschluckt,
 * genau das ist der Idempotenz-Mechanismus.
 */
async function enqueueOnce(
  admin: SupabaseClient,
  { type, payload, sendAt, dedupeKey }: EnqueueArgs
): Promise<boolean> {
  const { error } = await admin.from("scheduled_emails").insert({
    type,
    payload,
    send_at: sendAt.toISOString(),
    status: "pending",
    dedupe_key: dedupeKey,
  });
  if (error) {
    if (error.code === "23505") return false; // existiert bereits
    console.error("[reminders] enqueue fehlgeschlagen:", type, error.message);
    return false;
  }
  return true;
}

/**
 * Plant die Termin-Erinnerungen (24h und 2h vorher) für einen Termin.
 * Liegt der Zeitpunkt bereits in der Vergangenheit, wird der jeweilige
 * Reminder übersprungen (z. B. bei einer kurzfristigen Admin-Direktbuchung).
 */
export async function scheduleLessonReminders(
  admin: SupabaseClient,
  appointment: { id: string; student_id: string; start_at: string }
): Promise<void> {
  const start = new Date(appointment.start_at);
  const now = Date.now();

  const plan: Array<{ type: string; offsetMs: number }> = [
    { type: "lesson_reminder_24h", offsetMs: 24 * 3600 * 1000 },
    { type: "lesson_reminder_2h", offsetMs: 2 * 3600 * 1000 },
  ];

  for (const { type, offsetMs } of plan) {
    const sendAt = new Date(start.getTime() - offsetMs);
    if (sendAt.getTime() <= now) continue;
    await enqueueOnce(admin, {
      type,
      payload: {
        student_id: appointment.student_id,
        appointment_id: appointment.id,
        start_at: appointment.start_at,
      },
      sendAt,
      dedupeKey: `${type}:${appointment.id}`,
    });
  }
}

/** Bricht geplante Reminder eines Termins ab (Storno / Verschiebung). */
export async function cancelLessonReminders(
  admin: SupabaseClient,
  appointmentId: string
): Promise<void> {
  await admin
    .from("scheduled_emails")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .in("dedupe_key", [
      `lesson_reminder_24h:${appointmentId}`,
      `lesson_reminder_2h:${appointmentId}`,
    ]);
}

/**
 * Periodischer Scan: legt Erinnerungen für überfällige Zahlungen und bald
 * ablaufende Pakete an. Wird vom Cron aufgerufen und ist idempotent.
 */
export async function scanForDueReminders(
  admin: SupabaseClient
): Promise<{ overdue: number; expiring: number }> {
  const now = new Date();
  let overdue = 0;
  let expiring = 0;

  // ── 1. Überfällige Rechnungen ────────────────────────────────────
  const { data: invoices } = await admin
    .from("invoices")
    .select("id, student_id, amount, invoice_number, due_date, status")
    .in("status", ["unpaid", "rejected"])
    .not("due_date", "is", null)
    .lt("due_date", now.toISOString())
    .limit(200);

  for (const inv of invoices ?? []) {
    const created = await enqueueOnce(admin, {
      type: "payment_overdue",
      payload: {
        student_id: inv.student_id,
        invoice_id: inv.id,
        amount: inv.amount,
        invoice_number: inv.invoice_number,
        due_date: inv.due_date,
      },
      sendAt: now,
      dedupeKey: `payment_overdue:${inv.id}`,
    });
    if (created) overdue++;
  }

  // ── 2. Bald ablaufende Pakete ────────────────────────────────────
  const warnUntil = new Date(
    now.getTime() + PACKAGE_EXPIRY_WARN_DAYS * 24 * 3600 * 1000
  );
  const { data: packages } = await admin
    .from("packages")
    .select(
      "id, student_id, expires_at, lessons_total, lessons_used, paused, abo_variante"
    )
    .eq("status", "active")
    .eq("paused", false)
    // Abos bekommen keinen Verfalls-Hinweis.
    //
    // Die Nachricht „Dein Paket läuft ab, X Lektionen verfallen“ stammt aus
    // dem Lektionspaket-Modell und wäre beim Abo doppelt falsch: Es verfällt
    // nichts, und bei aktiver Verlängerung geht es ohnehin weiter. Abos
    // werden über `sendRenewalNotices` informiert, mit dem passenden Text.
    .is("abo_variante", null)
    .not("expires_at", "is", null)
    .gt("expires_at", now.toISOString())
    .lt("expires_at", warnUntil.toISOString())
    .limit(200);

  for (const pkg of packages ?? []) {
    const remaining = Math.max(
      0,
      Number(pkg.lessons_total ?? 0) - Number(pkg.lessons_used ?? 0)
    );
    // Aufgebrauchte Pakete brauchen keinen Ablauf-Hinweis.
    if (remaining === 0) continue;
    const created = await enqueueOnce(admin, {
      type: "package_expiring",
      payload: {
        student_id: pkg.student_id,
        package_id: pkg.id,
        expires_at: pkg.expires_at,
        lessons_remaining: remaining,
      },
      sendAt: now,
      dedupeKey: `package_expiring:${pkg.id}`,
    });
    if (created) expiring++;
  }

  return { overdue, expiring };
}
