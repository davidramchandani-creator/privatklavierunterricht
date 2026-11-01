// ============================================================
// Das Studio: wo der Unterricht stattfindet
//
// Seit November 2026 bietet David keine Hausbesuche mehr an. Neue Schüler
// kommen zu ihm ins Studio in Neftenbach, wo ein E-Piano mit gewichteten
// Tasten steht. Bestehende Hausbesuche laufen weiter, solange David sie im
// Admin so eingestellt lässt (Schalter „Ich fahre hin", `profiles.hausbesuch`).
//
// Öffentlich steht nur der Ort. Die volle Adresse erscheint nur dort, wo
// jemand angemeldet ist oder einen persönlichen Link hat: im Kalender des
// Schülers und in Davids eigenem Kalender.
//
// Die Adresse kommt aus derselben Einstellung wie der Startpunkt des
// Routenplaners (`routenplanung_zuhause`), damit sie an einer Stelle
// gepflegt wird.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export const STUDIO_ORT = "Neftenbach";
export const STUDIO_ADRESSE_VORGABE = "Sattleracherstrasse 59, 8413 Neftenbach";

/** Die volle Studioadresse aus den Einstellungen, sonst die Vorgabe. */
export async function ladeStudioAdresse(admin: SupabaseClient): Promise<string> {
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "routenplanung_zuhause")
    .maybeSingle();
  const adresse = (data?.value as { adresse?: string } | null)?.adresse;
  return adresse && adresse.trim() ? adresse.trim() : STUDIO_ADRESSE_VORGABE;
}

/**
 * Wo eine Lektion stattfindet.
 *
 * Kommt der Schüler zu David (`hausbesuch === false`), ist es das Studio,
 * sonst die Adresse des Schülers. Vorher stand im Kalender immer die
 * Schüleradresse, auch bei jemandem, der gar nicht besucht wird.
 */
export function unterrichtsort(
  schueler: { adresse: string | null; hausbesuch: boolean | null | undefined },
  studioAdresse: string
): string | null {
  if (schueler.hausbesuch === false) return studioAdresse;
  return schueler.adresse;
}
