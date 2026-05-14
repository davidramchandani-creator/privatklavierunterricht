"use server";

import { createClient } from "@/lib/supabase/server";
import { isWithin24Hours } from "@/lib/utils";

export type AvailableSlot = {
  beginn: string;
  ende: string;
};

export async function getVerfuegbareSlots(
  weekOffset: number
): Promise<AvailableSlot[]> {
  const supabase = await createClient();

  // 1. Get active availability slots
  const { data: verfuegbarkeit } = await supabase
    .from("admin_verfuegbarkeit")
    .select("*")
    .eq("aktiv", true);

  if (!verfuegbarkeit || verfuegbarkeit.length === 0) return [];

  // 2. Calculate week boundaries
  const now = new Date();
  const monday = getMonday(now, weekOffset);
  const sunday = new Date(monday.getTime() + 7 * 86400000);

  // 3. Fetch existing non-cancelled termine for that week
  const { data: booked } = await supabase
    .from("termine")
    .select("beginn, ende")
    .neq("status", "storniert")
    .gte("beginn", monday.toISOString())
    .lt("beginn", sunday.toISOString());

  const bookedSet = new Set(booked?.map((t) => t.beginn) ?? []);

  // 4. Generate 60-min slots for each availability window in the week
  const slots: AvailableSlot[] = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const date = new Date(monday.getTime() + dayIndex * 86400000);
    // wochentag in DB: 1=Mon, ..., 6=Sat, 0=Sun
    // date.getDay(): 0=Sun, 1=Mon, ..., 6=Sat
    const jsDay = date.getDay();
    const dbDay = jsDay; // same mapping in DB

    const dayVerfuegbarkeit = verfuegbarkeit.filter(
      (v) => v.wochentag === dbDay
    );

    for (const v of dayVerfuegbarkeit) {
      const [beginH, beginM] = v.beginn_zeit.split(":").map(Number);
      const [endH, endM] = v.ende_zeit.split(":").map(Number);

      const windowStart = new Date(date);
      windowStart.setHours(beginH, beginM, 0, 0);
      const windowEnd = new Date(date);
      windowEnd.setHours(endH, endM, 0, 0);

      let slotStart = new Date(windowStart);
      while (slotStart.getTime() + 60 * 60000 <= windowEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + 60 * 60000);

        // Only show future slots
        if (slotStart > now && !bookedSet.has(slotStart.toISOString())) {
          slots.push({
            beginn: slotStart.toISOString(),
            ende: slotEnd.toISOString(),
          });
        }

        slotStart = slotEnd;
      }
    }
  }

  return slots;
}

function getMonday(date: Date, offset: number): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

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
