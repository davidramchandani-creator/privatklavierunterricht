import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { erinnereAnNotizen } from "@/lib/lektionsnotizen-push";

export const dynamic = "force-dynamic";

/**
 * Erinnert an Lektionen ohne Eintrag.
 *
 * Läuft täglich abends über den Vercel-Cron. Die Route verträgt es aber,
 * beliebig oft aufgerufen zu werden — sie schickt höchstens eine Mitteilung
 * je Kalendertag. Wer die Erinnerung direkt nach jeder Stunde will, kann
 * deshalb einen externen Aufrufer im Viertelstundentakt darauf richten, ohne
 * dass etwas doppelt kommt.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();

  try {
    const ergebnis = await erinnereAnNotizen(admin);
    return Response.json({ ok: true, ...ergebnis });
  } catch (err) {
    console.error("[cron] Notiz-Erinnerung fehlgeschlagen:", err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
