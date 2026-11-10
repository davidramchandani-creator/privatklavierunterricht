// ============================================================
// Für welche Lehrperson wird gerechnet?
//
// Mehrere Lehrpersonen, Schritt 1c. Kollisionen, Arbeitszeiten, Sperren
// und Abwesenheiten gelten pro Lehrperson: Daniels Termin bei David
// blockiert nicht Annas Schüler, und umgekehrt.
//
// Die Lehrperson ergibt sich aus dem Schüler (`profiles.teacher_id`).
// Ohne Schüler (öffentliche Probelektion, freie Plätze) und ohne
// Zuordnung ist es David. So bleibt für David alles, wie es war.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AvailabilityWindows } from "./booking";

export type LehrpersonKontext = { teacherId: string | null; istInhaber: boolean };

/**
 * Lehrperson eines Schülers, sonst David.
 *
 * `teacherId: null` kommt nur vor, wenn es (noch) keine Lehrpersonen-
 * Tabelle gäbe. Dann filtern die Aufrufer gar nicht, wie vor dem Umbau.
 */
export async function lehrpersonFuer(
  admin: SupabaseClient,
  studentId: string | null | undefined,
  vorgabe?: string | null
): Promise<LehrpersonKontext> {
  let teacherId: string | null = vorgabe ?? null;

  if (!teacherId && studentId) {
    const { data } = await admin.from("profiles").select("teacher_id").eq("id", studentId).maybeSingle();
    teacherId = (data?.teacher_id as string | null) ?? null;
  }

  const { data: t } = teacherId
    ? await admin.from("teachers").select("id, ist_inhaber").eq("id", teacherId).maybeSingle()
    : await admin.from("teachers").select("id, ist_inhaber").eq("ist_inhaber", true).maybeSingle();

  if (!t) return { teacherId: null, istInhaber: true };
  return { teacherId: t.id as string, istInhaber: t.ist_inhaber === true };
}

/**
 * Arbeitszeiten für eine Lehrperson ohne eigene Einträge.
 *
 * David hat seine Zeiten im Admin gepflegt. Eine neue Lehrperson hat
 * keine, und ihre Termine entstehen ohnehin nur, wenn David sie nach ihrer
 * Antwort („ich habe Zeit“) zuteilt. Darum soll dort nur die Kollision
 * zählen, nicht Davids Arbeitszeiten (die sonst als Vorgabe gelten würden):
 * Montag bis Samstag, 08:00 bis 21:00.
 */
export const OFFENE_FENSTER: AvailabilityWindows = {
  1: [{ start: "08:00", end: "21:00" }],
  2: [{ start: "08:00", end: "21:00" }],
  3: [{ start: "08:00", end: "21:00" }],
  4: [{ start: "08:00", end: "21:00" }],
  5: [{ start: "08:00", end: "21:00" }],
  6: [{ start: "08:00", end: "21:00" }],
};

/** Davids Lehrpersonen-ID (Inhaber). */
export async function inhaberTeacherId(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.from("teachers").select("id").eq("ist_inhaber", true).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
