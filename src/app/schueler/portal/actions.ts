"use server";

import { createClient } from "@/lib/supabase/server";
import { isWithin24Hours } from "@/lib/utils";

export async function storniereTermin(termin_id: string, schueler_id: string) {
  const supabase = await createClient();

  const { data: termin } = await supabase
    .from("termine")
    .select("beginn, schueler_id")
    .eq("id", termin_id)
    .single();

  if (!termin || termin.schueler_id !== schueler_id) {
    return { error: "Termin nicht gefunden." };
  }

  if (isWithin24Hours(new Date(termin.beginn))) {
    return { error: "Absage weniger als 24 Stunden vorher ist nicht möglich." };
  }

  const { error } = await supabase
    .from("termine")
    .update({ status: "storniert" })
    .eq("id", termin_id)
    .eq("schueler_id", schueler_id);

  if (error) return { error: "Termin konnte nicht abgesagt werden." };

  return { success: true };
}

export async function buchTermin(
  schueler_id: string,
  paket_id: string,
  beginn: string,
  ende: string
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  // Verify schueler belongs to this user
  const { data: schueler } = await supabase
    .from("schueler")
    .select("id")
    .eq("id", schueler_id)
    .eq("user_id", user.id)
    .single();
  if (!schueler) return { error: "Zugriff verweigert." };

  // Check paket is active and has remaining lessons
  const { data: paket } = await supabase
    .from("pakete")
    .select("lektionen_gesamt, lektionen_genutzt, aktiv, gueltig_bis")
    .eq("id", paket_id)
    .eq("schueler_id", schueler_id)
    .single();

  if (!paket) return { error: "Paket nicht gefunden." };
  if (!paket.aktiv) return { error: "Dein Paket ist nicht aktiv." };
  if (paket.lektionen_genutzt >= paket.lektionen_gesamt) return { error: "Keine Lektionen mehr übrig." };
  if (paket.gueltig_bis && new Date(paket.gueltig_bis) < new Date()) {
    return { error: "Dein Paket ist abgelaufen." };
  }

  // Check for conflicting termine
  const { data: conflict } = await supabase
    .from("termine")
    .select("id")
    .neq("status", "storniert")
    .or(`beginn.lt.${ende},ende.gt.${beginn}`)
    .maybeSingle();

  if (conflict) return { error: "Dieser Zeitslot ist bereits gebucht." };

  const { error } = await supabase.from("termine").insert({
    schueler_id,
    paket_id,
    beginn,
    ende,
    status: "bestaetigt",
  });

  if (error) return { error: "Buchung fehlgeschlagen. Bitte versuche es erneut." };

  return { success: true };
}

export async function submitBewertung(
  schueler_id: string,
  sterne: number,
  text: string | null
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: schueler } = await supabase
    .from("schueler")
    .select("id")
    .eq("id", schueler_id)
    .eq("user_id", user.id)
    .single();
  if (!schueler) return { error: "Zugriff verweigert." };

  if (sterne < 1 || sterne > 5) return { error: "Ungültige Bewertung." };

  const { error } = await supabase.from("bewertungen").upsert(
    {
      schueler_id,
      sterne,
      text,
      anzeigen: false,
    },
    { onConflict: "schueler_id" }
  );

  if (error) return { error: "Bewertung konnte nicht gespeichert werden." };

  return { success: true };
}
