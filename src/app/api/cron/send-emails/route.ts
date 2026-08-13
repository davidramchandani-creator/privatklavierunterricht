import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { dispatchEmail } from "@/lib/email-dispatch";
import { scanForDueReminders } from "@/lib/reminders";
import { runSubscriptionJobs } from "@/lib/subscription-jobs";

export const dynamic = "force-dynamic";

/**
 * So oft wird eine Mail höchstens versucht.
 *
 * Der Lauf ist täglich, also erstreckt sich das über drei Tage. Genug, um
 * einen Ausfall beim Anbieter zu überstehen. Mehr wäre schädlich: eine Mail,
 * die aus einem dauerhaften Grund scheitert (kein auflösbarer Empfänger etwa),
 * würde sonst jeden Tag aufs Neue einen Fehler schreiben und den Blick auf
 * die echten Probleme verstellen.
 */
const MAX_SENDEVERSUCHE = 3;

export async function GET(request: NextRequest) {
  // Auth check
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();

  // Erst neue Erinnerungen einplanen (ueberfaellige Zahlungen, ablaufende
  // Pakete), damit sie im selben Lauf direkt mitversendet werden.
  let scanned = { overdue: 0, expiring: 0 };
  try {
    scanned = await scanForDueReminders(admin);
  } catch (err) {
    console.error("[cron] Reminder-Scan fehlgeschlagen:", err);
  }

  // Abo-Automatik: fällige Raten fakturieren, überfällige markieren,
  // Verlängerungen vorwarnen und ausführen. Läuft vor dem Mailversand,
  // damit neu erzeugte Mails im selben Durchgang rausgehen.
  let subscriptions = {
    instalmentsInvoiced: 0,
    instalmentsOverdue: 0,
    renewalNotices: 0,
    renewed: 0,
    expired: 0,
  };
  try {
    subscriptions = await runSubscriptionJobs(admin);
  } catch (err) {
    console.error("[cron] Abo-Jobs fehlgeschlagen:", err);
  }

  // Fällige Mails holen, offene **und** zuvor gescheiterte.
  //
  // Ein Fehlschlag ist meistens vorübergehend: der Mailanbieter war kurz
  // nicht erreichbar. Vorher blieb so eine Mail für immer liegen, ohne dass
  // es jemand merkte; im Bestand stehen fünf Terminbestätigungen und
  // Zahlungsaufforderungen, die nie angekommen sind. Darum wird begrenzt
  // wiederholt.
  const { data: emails } = await admin
    .from("scheduled_emails")
    .select("id, type, payload, versuche")
    .in("status", ["pending", "failed"])
    .lt("versuche", MAX_SENDEVERSUCHE)
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(50);

  if (!emails?.length) {
    return Response.json({ sent: 0, ...scanned, subscriptions });
  }

  let sent = 0;
  let failed = 0;
  let aufgegeben = 0;

  for (const email of emails) {
    const versuche = (email.versuche ?? 0) + 1;
    try {
      await dispatchEmail(admin, email.type, email.payload as Record<string, unknown>);

      await admin
        .from("scheduled_emails")
        .update({ status: "sent", sent_at: new Date().toISOString(), versuche })
        .eq("id", email.id);

      sent++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const endgueltig = versuche >= MAX_SENDEVERSUCHE;
      console.error(
        `[cron] Mail ${email.id} (${email.type}) fehlgeschlagen, Versuch ${versuche}/${MAX_SENDEVERSUCHE}${
          endgueltig ? ", wird nicht mehr wiederholt" : ""
        }:`,
        errMsg
      );

      await admin
        .from("scheduled_emails")
        .update({ status: "failed", error_message: errMsg, versuche })
        .eq("id", email.id);

      failed++;
      if (endgueltig) aufgegeben++;
    }
  }

  return Response.json({ sent, failed, aufgegeben, ...scanned, subscriptions });
}
