import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchEmail } from "@/lib/email-dispatch";

/**
 * Reiht eine E-Mail in die Outbox (`scheduled_emails`) ein.
 * Nutzen: Payment-Mails, die erst nach `end_at` versendet werden sollen.
 * Für Sofortversand transaktionaler Mails → `sendEmailNow` verwenden.
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
    console.error("enqueueEmail failed:", type, error.message);
  }
}

/**
 * Sendet eine transaktionale E-Mail sofort (ohne Outbox-Verzögerung).
 * Löst Empfänger, rendert Template und sendet via Resend.
 * Fehler werden geloggt aber nicht geworfen, die fachliche Aktion soll
 * trotzdem gelingen.
 */
export async function sendEmailNow(
  admin: SupabaseClient,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await dispatchEmail(admin, type, payload);
  } catch (err) {
    console.error(
      "sendEmailNow failed:",
      type,
      err instanceof Error ? err.message : String(err)
    );
  }
}
