import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

/**
 * Nur geschützte Bereiche laufen durch die Middleware.
 *
 * Die Middleware fragt bei jedem Durchlauf die Supabase-Sitzung ab — ein
 * Netzwerk-Roundtrip vor dem ersten Byte. Für die Startseite, die Preise
 * oder die AGB ist das reine Wartezeit: Dort gibt es nichts zu schützen.
 *
 * Vorher war es umgekehrt gelöst — alles lief durch, ausgenommen eine lange
 * Liste von Dateiendungen. Das war fehleranfällig (jedes neue Format musste
 * nachgetragen werden, sonst wurde ein Video auf die Loginseite umgeleitet)
 * und langsam, weil jede öffentliche Seite den Auth-Roundtrip zahlte.
 *
 * Jetzt zählt die Liste auf, was tatsächlich eine Anmeldung braucht. Kommt
 * ein neuer geschützter Bereich dazu, gehört er hier ergänzt — das ist die
 * Kehrseite und der Grund für den Test in pfad.test.ts.
 */
export const config = {
  matcher: [
    "/admin/:path*",
    "/schueler/:path*",
    "/auth/login",
    "/benachrichtigungen",
  ],
};
