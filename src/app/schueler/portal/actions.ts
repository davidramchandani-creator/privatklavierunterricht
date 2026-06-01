"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { addMonths, isWithin24Hours } from "@/lib/utils";
import {
  type Package as Paket,
  PACKAGE_LABELS,
  PACKAGE_LESSONS,
  PACKAGE_VALIDITY_MONTHS,
  canBuyNewPackage,
  computePackageState,
  pricePerLessonFor,
} from "@/lib/packages";

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

/**
 * Schüler bucht ein neues Paket (10er oder 20er) im Portal.
 * Preis wird serverseitig aus dem Profil berechnet – nie aus dem Client
 * übernommen. Insert läuft über den Service-Role-Client, da die RLS auf
 * `packages` nur Admin-Inserts erlaubt; sämtliche Geschäftsregeln werden
 * vorher serverseitig geprüft.
 */
export async function buyPackage(type: "10er" | "20er", agbAccepted: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  if (!agbAccepted) return { error: "Bitte akzeptiere zuerst die AGB." };
  if (type !== "10er" && type !== "20er") {
    return { error: "Ungültiger Pakettyp." };
  }

  // Profil + Preise des angemeldeten Schülers laden
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, price_single, price_10er, price_20er, travel_surcharge")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profil nicht gefunden." };

  // Prüfen, ob bereits ein nutzbares Paket existiert (Spec §5)
  const { data: existing } = await supabase
    .from("packages")
    .select("*")
    .eq("student_id", user.id)
    .eq("status", "active");

  const usable = (existing ?? []).find(
    (p) => !canBuyNewPackage(p as Paket)
  );
  if (usable) {
    const state = computePackageState(usable as Paket);
    return {
      error: `Du hast noch ${state.lessonsRemaining} Lektion${
        state.lessonsRemaining !== 1 ? "en" : ""
      } offen. Ein neues Paket kannst du erst danach buchen.`,
    };
  }

  const lessonsTotal = PACKAGE_LESSONS[type];
  const validityMonths = PACKAGE_VALIDITY_MONTHS[type];
  const ppl = pricePerLessonFor(type, {
    price_single: Number(profile.price_single),
    price_10er: Number(profile.price_10er),
    price_20er: Number(profile.price_20er),
    travel_surcharge: Number(profile.travel_surcharge),
  });
  const totalPrice = ppl * lessonsTotal;

  const startsAt = new Date();
  const expiresAt =
    validityMonths != null ? addMonths(startsAt, validityMonths) : null;

  const admin = await createAdminClient();
  const { error } = await admin.from("packages").insert({
    student_id: user.id,
    type,
    lessons_total: lessonsTotal,
    lessons_used: 0,
    name: PACKAGE_LABELS[type],
    price_per_lesson: ppl,
    total_price: totalPrice,
    starts_at: startsAt.toISOString(),
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    status: "active",
  });

  if (error) {
    return { error: "Paket konnte nicht gebucht werden. Bitte versuche es erneut." };
  }

  revalidatePath("/schueler/portal");
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
