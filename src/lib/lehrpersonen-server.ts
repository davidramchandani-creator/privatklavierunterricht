import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { OEFFENTLICHE_FELDER, type OeffentlicheLehrperson } from "./lehrpersonen";

export const LEHRPERSONEN_TAG = "lehrpersonen";

/**
 * Lehrpersonen für die Webseite: aktiv und mit freigegebenem Text.
 *
 * Liest mit dem Service-Schlüssel, aber nur die Spalten aus
 * `OEFFENTLICHE_FELDER`. Adresse, Startpunkt, Lohn und Login kommen hier
 * nie vorbei. Eine Stunde zwischengespeichert, nach Änderungen im Admin
 * sofort neu.
 */
async function laden(): Promise<OeffentlicheLehrperson[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("teachers")
    .select(OEFFENTLICHE_FELDER)
    .eq("status", "aktiv")
    .not("kurztext", "is", null)
    .order("ist_inhaber", { ascending: false })
    .order("sortierung", { ascending: true })
    .order("vorname", { ascending: true });
  return ((data ?? []) as OeffentlicheLehrperson[]).filter((l) => (l.kurztext ?? "").trim() !== "");
}

export const ladeOeffentlicheLehrpersonen = unstable_cache(laden, ["lehrpersonen-oeffentlich-v1"], {
  revalidate: 3600,
  tags: [LEHRPERSONEN_TAG],
});
