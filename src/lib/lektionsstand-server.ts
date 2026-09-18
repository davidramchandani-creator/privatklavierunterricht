import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Wie viele Lektionen eines Pakets stattgefunden haben, und wie viele noch
 * geplant sind.
 *
 * Beim Abo stehen alle Termine von Anfang an im Kalender. Zählt man die
 * gebuchten, ist ein frisches Abo sofort „10 von 10 verbraucht". Was der
 * Schüler wissen will: Wie viele hatte ich schon, wie viele kommen noch.
 *
 *   stattgefunden   abgeschlossen, nicht erschienen, oder gebucht und vorbei
 *   geplant         gebucht, liegt noch vor uns
 */
export type Lektionsstand = { stattgefunden: number; geplant: number };

export async function ladeLektionsstand(
  admin: SupabaseClient,
  packageIds: string[],
  jetzt: Date = new Date()
): Promise<Map<string, Lektionsstand>> {
  const stand = new Map<string, Lektionsstand>();
  for (const id of packageIds) stand.set(id, { stattgefunden: 0, geplant: 0 });
  if (packageIds.length === 0) return stand;

  const { data } = await admin
    .from("appointments")
    .select("package_id, status, end_at")
    .in("package_id", packageIds)
    .in("status", ["booked", "completed", "no_show"])
    // Zusatzlektionen hängen am Abo, gehören aber nicht zu seinen Lektionen.
    .eq("zusatzlektion", false);

  const jetztMs = jetzt.getTime();
  for (const a of data ?? []) {
    const s = stand.get(a.package_id as string);
    if (!s) continue;
    const vorbei = new Date(a.end_at as string).getTime() <= jetztMs;
    if (a.status === "booked" && !vorbei) s.geplant++;
    else s.stattgefunden++;
  }
  return stand;
}
