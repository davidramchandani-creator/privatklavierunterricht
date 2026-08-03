import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { dispatchEmail } from "@/lib/email-dispatch";
import { scanForDueReminders } from "@/lib/reminders";

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

  // Fetch up to 20 pending emails due now
  const { data: emails } = await admin
    .from("scheduled_emails")
    .select("id, type, payload")
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(50);

  if (!emails?.length) return Response.json({ sent: 0, ...scanned });

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

  return Response.json({ sent, failed, ...scanned });
}
