import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

/**
 * Statische Dateien laufen gar nicht erst durch die Middleware.
 *
 * Nicht nur der Ordnung halber: Die Middleware fragt bei jedem Durchlauf die
 * Supabase-Sitzung ab. Beim Vorspulen in einem Video schickt der Browser
 * Dutzende Teilanfragen — das wären Dutzende Auth-Abfragen für eine einzige
 * Aufnahme, die ohnehin öffentlich ist.
 *
 * Die Liste deckt ab, was tatsächlich unter public/ liegt. Kommt ein neues
 * Format dazu, gehört es hier ergänzt.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm|mov|mp3|m4a|ogg|wav|pdf|woff|woff2|ttf|txt|xml|webmanifest)$).*)",
  ],
};
