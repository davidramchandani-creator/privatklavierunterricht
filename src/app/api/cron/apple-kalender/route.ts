import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { gleicheAppleKalenderAb } from "@/lib/apple-kalender";

export const dynamic = "force-dynamic";

/**
 * Apple-Kalender einlesen.
 *
 * Läuft einmal täglich um die Mittagszeit — nicht öfter, und das ist eine
 * harte Grenze, keine Wahl: Vercels Hobby-Plan erlaubt nur tägliche Crons
 * und **verweigert sonst das gesamte Deployment**. Ein Viertelstunden-Takt
 * hier hat einmal jede Auslieferung blockiert, ohne dass ein Build-Log
 * entstand — die Ablehnung sieht man nur beim manuellen Deploy-Versuch.
 *
 * Der tägliche Takt genügt, weil er nur die Grundversorgung ist: Vor jeder
 * Verfügbarkeitsberechnung wird der Kalender ohnehin geholt, wenn der
 * letzte Abruf älter als eine Minute ist, und vor jeder echten Buchung
 * immer (siehe `stelleAppleKalenderSicher`). Dieser Cron sorgt nur dafür,
 * dass der erste Seitenaufruf des Tages nicht der langsame ist.
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
  const res = await gleicheAppleKalenderAb(admin);

  if ("error" in res) {
    // Kein hinterlegter Kalender ist der Normalfall, kein Fehler.
    const ok = res.error === "Kein Kalender hinterlegt.";
    return Response.json({ ok, hinweis: res.error }, { status: ok ? 200 : 500 });
  }

  return Response.json({ ok: true, ...res });
}
