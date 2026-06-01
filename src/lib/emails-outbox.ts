import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reiht eine E-Mail in die Outbox (`scheduled_emails`) ein. Der eigentliche
 * Versand via Resend erfolgt in Meilenstein 11 über einen Cron-Job, der
 * fällige Einträge (`status='pending'`, `send_at <= now`) abarbeitet.
 *
 * Muss mit einem Service-Role-Client aufgerufen werden (RLS: nur Admin).
 */
export async function enqueueEmail(
  admin: SupabaseClient,
  type: string,
  payload: Record<string, unknown>,
  sendAt?: Date
): Promise<void> {
  const { error } = await admin.from("scheduled_emails").insert({
    type,
    payload,
    send_at: (sendAt ?? new Date()).toISOString(),
    status: "pending",
  });
  if (error) {
    // Nicht blockierend – die fachliche Aktion soll trotzdem gelingen.
    console.error("enqueueEmail failed:", type, error.message);
  }
}
