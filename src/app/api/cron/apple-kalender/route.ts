import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { gleicheAppleKalenderAb } from "@/lib/apple-kalender";

export const dynamic = "force-dynamic";

/**
 * Apple-Kalender einlesen.
 *
 * Eigener Endpunkt neben dem täglichen Mail-Cron, weil er in einem ganz
 * anderen Takt laufen soll: Sperrzeiten müssen kurz nach dem Eintragen
 * greifen, Rechnungen und Mails brauchen das nicht.
 *
 * Zusätzlich — und wichtiger — wird der Kalender vor jeder
 * Verfügbarkeitsberechnung geholt, wenn der letzte Abruf älter als eine
 * Minute ist (siehe `stelleAppleKalenderSicher`). Dieser Cron ist nur die
 * Grundversorgung für Zeiten, in denen niemand die Seite benutzt: Ohne ihn
 * wäre der erste Seitenaufruf am Morgen der langsame.
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
