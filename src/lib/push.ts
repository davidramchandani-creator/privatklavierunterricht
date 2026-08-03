/**
 * Web-Push (Meilenstein Benachrichtigungen).
 *
 * Versendet Push-Nachrichten an alle Geräte eines Nutzers. Ergänzt die E-Mails,
 * ersetzt sie nicht: Auf iOS funktioniert Push nur, wenn die PWA über
 * "Zum Home-Bildschirm" installiert wurde (ab iOS 16.4).
 *
 * Benötigt die Umgebungsvariablen:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  – öffentlicher Schlüssel (auch im Browser)
 *   VAPID_PRIVATE_KEY             – privater Schlüssel (nur serverseitig!)
 *   VAPID_SUBJECT                 – mailto:… Kontaktadresse
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type PushPayload = {
  title: string;
  body: string;
  /** Ziel-URL beim Klick auf die Benachrichtigung. */
  url?: string;
  /** Gleiche tag = ersetzt vorherige Benachrichtigung statt zu stapeln. */
  tag?: string;
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Sendet eine Push-Nachricht an alle Geräte eines Nutzers.
 * Fehler werden geloggt, aber nie geworfen – die fachliche Aktion (Buchung,
 * Zahlung …) darf nie an einer Benachrichtigung scheitern.
 *
 * Abos, die der Push-Dienst mit 404/410 ablehnt, werden sofort gelöscht
 * (Gerät deinstalliert / Abo widerrufen).
 */
export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; removed: number }> {
  if (!isPushConfigured()) return { sent: 0, removed: 0 };

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, failure_count")
    .eq("user_id", userId);

  if (!subs?.length) return { sent: 0, removed: 0 };

  // web-push nur laden, wenn wirklich gesendet wird (kleinere Cold-Starts).
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:david.privatklavierunterricht@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const body = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;

  for (const sub of subs as SubscriptionRow[]) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
        { TTL: 60 * 60 * 24 }
      );
      sent++;
      await admin
        .from("push_subscriptions")
        .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
        .eq("id", sub.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410 = Abo endgültig ungültig → aufräumen.
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
        removed++;
      } else {
        console.error("[push] Versand fehlgeschlagen:", status, sub.endpoint.slice(0, 60));
        await admin
          .from("push_subscriptions")
          .update({ failure_count: sub.failure_count + 1 })
          .eq("id", sub.id);
      }
    }
  }

  return { sent, removed };
}

/** Push an den Admin (alle seine Geräte). */
export async function sendPushToAdmin(
  admin: SupabaseClient,
  payload: PushPayload
): Promise<void> {
  const { data: admins } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin");
  for (const a of admins ?? []) {
    await sendPushToUser(admin, a.id as string, payload);
  }
}
