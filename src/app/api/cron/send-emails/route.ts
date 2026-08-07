import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { dispatchEmail } from "@/lib/email-dispatch";
import { scanForDueReminders } from "@/lib/reminders";
import { runSubscriptionJobs } from "@/lib/subscription-jobs";

export const dynamic = "force-dynamic";

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

  // Fetch up to 20 pending emails due now
  const { data: emails } = await admin
    .from("scheduled_emails")
    .select("id, type, payload")
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(50);

  if (!emails?.length) return Response.json({ sent: 0, ...scanned, subscriptions });

  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      await dispatchEmail(admin, email.type, email.payload as Record<string, unknown>);

      await admin
        .from("scheduled_emails")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", email.id);

      sent++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to send email ${email.id}:`, errMsg);

      await admin
        .from("scheduled_emails")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", email.id);

      failed++;
    }
  }

  return Response.json({ sent, failed, ...scanned, subscriptions });
}
