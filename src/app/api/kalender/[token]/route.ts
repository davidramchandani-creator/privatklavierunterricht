import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { baueFeed } from "@/lib/kalender-feed";
import { ladeFeedTermine, loeseToken } from "@/lib/kalender-feed-server";

export const dynamic = "force-dynamic";

/**
 * Der abonnierbare Kalender.
 *
 * Wird von der Kalender-App des Schülers oder von Davids Handy abgerufen,
 * ohne Login: Kalender-Apps können sich nirgends anmelden. Der Zugriffs-
 * schutz ist der Token in der Adresse.
 *
 * Bei unbekanntem Token kommt 404, ohne Hinweis darauf, ob es so einen
 * Token je gab. Ein „ungültig" wäre eine Auskunft.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  // Apple hängt beim Abonnieren manchmal ".ics" an. Beides annehmen.
  const sauber = token.replace(/\.ics$/, "");

  const admin = createAdminClient();
  const wer = await loeseToken(admin, sauber);
  if (!wer) return new Response("Nicht gefunden", { status: 404 });

  const termine = await ladeFeedTermine(admin, wer);
  const feed = baueFeed(termine, wer.sicht);

  return new Response(feed, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Kein Download-Dialog: Kalender-Apps wollen den Inhalt, kein
      // Browser-Fenster. Wer die Adresse im Browser öffnet, bekommt Text.
      "Content-Disposition": 'inline; filename="klavierunterricht.ics"',
      // Nie im Browser oder bei Vercel zwischenspeichern: Eine Verschiebung
      // von vorhin muss beim nächsten Abruf drin sein.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
