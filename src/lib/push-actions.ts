"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendPushToUser, isPushConfigured } from "@/lib/push";

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

/** Speichert (oder aktualisiert) das Push-Abo des angemeldeten Nutzers. */
export async function savePushSubscription(sub: PushSubscriptionInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  if (!sub.endpoint || !sub.p256dh || !sub.auth) {
    return { error: "Ungültiges Abo." };
  }

  const admin = await createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent ?? null,
      failure_count: 0,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("[push] Abo speichern fehlgeschlagen:", error.message);
    return { error: "Abo konnte nicht gespeichert werden." };
  }
  return { success: true };
}

/** Entfernt ein Abo (Nutzer schaltet Benachrichtigungen ab). */
export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const admin = await createAdminClient();
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  return { success: true };
}

/** Sendet eine Test-Benachrichtigung an den angemeldeten Nutzer. */
export async function sendTestPush() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  if (!isPushConfigured()) {
    return { error: "Push ist auf dem Server noch nicht konfiguriert (VAPID-Schlüssel fehlen)." };
  }

  const admin = await createAdminClient();
  const { sent } = await sendPushToUser(admin, user.id, {
    title: "Test-Benachrichtigung",
    body: "Super, Benachrichtigungen funktionieren auf diesem Gerät.",
    url: "/schueler/portal",
    tag: "test",
  });

  if (sent === 0) {
    return { error: "Kein aktives Gerät gefunden. Aktiviere die Benachrichtigungen zuerst." };
  }
  return { success: true as const, sent };
}

/** Ob der Server Push überhaupt versenden kann (VAPID gesetzt). */
export async function getPushServerStatus() {
  return { configured: isPushConfigured() };
}
