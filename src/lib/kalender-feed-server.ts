// ============================================================
// Abonnierbarer Kalender: Token verwalten, Termine holen
// ============================================================

import { inhaberTeacherId } from "./lehrperson-kontext";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ladeStudioAdresse, unterrichtsort } from "./studio";
import {
  FEED_RUECKBLICK_TAGE,
  FEED_VORSCHAU_TAGE,
  neuerToken,
  type FeedTermin,
} from "./kalender-feed";

const ADMIN_TOKEN_SCHLUESSEL = "kalender_token_admin";

/**
 * Token eines Schülers, bei Bedarf erzeugt.
 *
 * Erst beim ersten Öffnen des Abo-Knopfs, nicht beim Anlegen des Kontos:
 * Ein Token, den niemand je abruft, ist ein Schlüssel, der nur herumliegt.
 */
export async function schuelerToken(
  admin: SupabaseClient,
  studentId: string
): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("kalender_token")
    .eq("id", studentId)
    .maybeSingle();
  if (data?.kalender_token) return data.kalender_token as string;

  const token = neuerToken();
  await admin.from("profiles").update({ kalender_token: token }).eq("id", studentId);
  return token;
}

/** Neuer Token. Der alte Link funktioniert ab sofort nicht mehr. */
export async function schuelerTokenZuruecksetzen(
  admin: SupabaseClient,
  studentId: string
): Promise<string> {
  const token = neuerToken();
  await admin.from("profiles").update({ kalender_token: token }).eq("id", studentId);
  return token;
}

export async function adminToken(admin: SupabaseClient): Promise<string> {
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", ADMIN_TOKEN_SCHLUESSEL)
    .maybeSingle();
  const vorhanden = (data?.value as { token?: string } | null)?.token;
  if (vorhanden) return vorhanden;
  return adminTokenZuruecksetzen(admin);
}

export async function adminTokenZuruecksetzen(admin: SupabaseClient): Promise<string> {
  const token = neuerToken();
  await admin.from("app_settings").upsert({
    key: ADMIN_TOKEN_SCHLUESSEL,
    value: { token },
    updated_at: new Date().toISOString(),
  });
  return token;
}

/**
 * Wem gehört dieser Token? Schüler, Admin, oder niemandem.
 *
 * Erst die Schüler, dann der Admin: Bei einem Treffer im Profil ist die
 * Frage beantwortet, der Admin-Token wird nur bei Bedarf gelesen.
 */
export async function loeseToken(
  admin: SupabaseClient,
  token: string
): Promise<{ sicht: "schueler"; studentId: string } | { sicht: "admin" } | null> {
  if (!token || token.length < 20) return null;

  const { data: profil } = await admin
    .from("profiles")
    .select("id, aktiv")
    .eq("kalender_token", token)
    .maybeSingle();
  if (profil) {
    // Ein deaktivierter Schüler hat keinen Kalender mehr. Sein Token bleibt
    // gespeichert, liefert aber nichts; so wird er beim Reaktivieren nicht
    // neu erzeugt und das Abo auf dem Handy lebt weiter.
    if (profil.aktiv === false) return null;
    return { sicht: "schueler", studentId: profil.id as string };
  }

  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", ADMIN_TOKEN_SCHLUESSEL)
    .maybeSingle();
  if ((data?.value as { token?: string } | null)?.token === token) {
    return { sicht: "admin" };
  }
  return null;
}

type Zeile = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  profiles: { vorname: string; nachname: string; adresse: string | null; hausbesuch: boolean | null } | null;
};

/** Termine für den Feed, vom Rückblick bis zur Vorschau. */
export async function ladeFeedTermine(
  admin: SupabaseClient,
  wer: { sicht: "schueler"; studentId: string } | { sicht: "admin" },
  jetzt: Date = new Date()
): Promise<FeedTermin[]> {
  const von = new Date(jetzt.getTime() - FEED_RUECKBLICK_TAGE * 86_400_000);
  const bis = new Date(jetzt.getTime() + FEED_VORSCHAU_TAGE * 86_400_000);

  let abfrage = admin
    .from("appointments")
    .select(
      "id, start_at, end_at, status, profiles!inner(vorname, nachname, adresse, hausbesuch, ist_test)"
    )
    // Abgesagte Lektionen fehlen in beiden Kalendern, bei David und bei den
    // Schülern. Durchgestrichen mit doppeltem „Abgesagt" machten sie den Tag
    // unübersichtlich, und nach der Semesterumstellung wären es viele
    // (David, 3. November 2026). Fehlt ein Termin im Abo, entfernt ihn die
    // Kalender-App beim nächsten Abruf. Dass abgesagt wurde, steht im Portal
    // und in der Mail.
    .in("status", ["booked", "completed"])
    .gte("start_at", von.toISOString())
    .lte("start_at", bis.toISOString())
    .order("start_at", { ascending: true })
    .limit(1000);

  if (wer.sicht === "schueler") {
    abfrage = abfrage.eq("student_id", wer.studentId);
  } else {
    // Der Testschüler gehört nicht in Davids echten Kalender. Ebenso wenig
    // die Lektionen anderer Lehrpersonen: Davids Kalender ist sein eigener
    // Stundenplan, die Übersicht über alle hat er im Admin.
    abfrage = abfrage.eq("profiles.ist_test", false);
    const inhaber = await inhaberTeacherId(admin);
    if (inhaber) abfrage = abfrage.eq("teacher_id", inhaber);
  }

  const [{ data }, studioAdresse] = await Promise.all([
    abfrage,
    ladeStudioAdresse(admin),
  ]);
  return ((data ?? []) as unknown as Zeile[]).map((z) => ({
    id: z.id,
    beginn: z.start_at,
    ende: z.end_at,
    status: z.status,
    name: z.profiles ? `${z.profiles.vorname} ${z.profiles.nachname}`.trim() : "Schüler",
    // Wer zu David kommt, sieht das Studio, nicht die eigene Adresse.
    adresse: z.profiles ? unterrichtsort(z.profiles, studioAdresse) : null,
    hausbesuch: z.profiles?.hausbesuch ?? true,
  }));
}
