// ============================================================
// Abonnierbarer Kalender: Token verwalten, Termine holen
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
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
    // Abgesagte bleiben drin und erscheinen durchgestrichen; siehe
    // kalender-feed.ts. Nur was nie stattfand, fehlt.
    .in("status", ["booked", "completed", "cancelled"])
    .gte("start_at", von.toISOString())
    .lte("start_at", bis.toISOString())
    .order("start_at", { ascending: true })
    .limit(1000);

  if (wer.sicht === "schueler") {
    abfrage = abfrage.eq("student_id", wer.studentId);
  } else {
    // Der Testschüler gehört nicht in Davids echten Kalender.
    abfrage = abfrage.eq("profiles.ist_test", false);
  }

  const { data } = await abfrage;
  return ((data ?? []) as unknown as Zeile[]).map((z) => ({
    id: z.id,
    beginn: z.start_at,
    ende: z.end_at,
    status: z.status,
    name: z.profiles ? `${z.profiles.vorname} ${z.profiles.nachname}`.trim() : "Schüler",
    adresse: z.profiles?.adresse ?? null,
    hausbesuch: z.profiles?.hausbesuch ?? true,
  }));
}
