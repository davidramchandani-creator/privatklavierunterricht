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
import {
  type CalDate,
  DEFAULT_BUFFER_MIN,
  SERIES_INTERVALS,
  SERIES_LESSON_COUNTS,
  addDaysCal,
  computeAvailableSlots,
  generateSeriesStarts,
  isAtLeast24hAway,
  utcToZonedDate,
  validateSeries,
  weekdayOf,
  zonedToUtc,
} from "@/lib/booking";
import { loadAvailabilityContext } from "@/lib/booking-server";
import { enqueueEmail } from "@/lib/emails-outbox";

export type AvailableSlot = {
  beginn: string;
  ende: string;
};

/**
 * Freie Slots einer Woche über die Buchungs-Engine (Meilenstein 4).
 * Belegte Zeiten werden via Service-Role gelesen (Kollisionsprüfung),
 * nach aussen gehen nur freie Slot-Zeiten.
 */
export async function getVerfuegbareSlots(
  weekOffset: number
): Promise<AvailableSlot[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("buffer_time_minutes")
    .eq("id", user.id)
    .maybeSingle();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  const now = new Date();

  // Montag der Zielwoche (Zürcher Kalenderdatum)
  const todayCal = utcToZonedDate(now);
  const w = weekdayOf(todayCal); // 0=So … 6=Sa
  const mondayOffset = w === 0 ? -6 : 1 - w;
  const fromCal: CalDate = addDaysCal(todayCal, mondayOffset + weekOffset * 7);

  const fromInstant = zonedToUtc(fromCal.y, fromCal.m, fromCal.d, 0, 0);
  const toInstant = new Date(fromInstant.getTime() + 7 * 86400000);

  const admin = await createAdminClient();
  const ctx = await loadAvailabilityContext(
    admin,
    user.id,
    bufferMin,
    fromInstant,
    toInstant,
    now
  );

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
      while (slotStart.getTime() + 45 * 60000 <= windowEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + 45 * 60000);

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

/**
 * Schüler stellt eine Terminanfrage (öffentliche Buchung, Spec §4.1).
 * Optional als Serie (1/5/10 Lektionen, Intervall 7/14 Tage). Wird als
 * `booking_requests` (status open) gespeichert; Termine entstehen erst bei
 * Admin-Annahme.
 */
export async function requestBooking(
  desiredStartIso: string,
  lessonsCount: number,
  intervalDays: number
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  if (!SERIES_LESSON_COUNTS.includes(lessonsCount as 1 | 5 | 10)) {
    return { error: "Ungültige Lektionsanzahl." };
  }
  if (!SERIES_INTERVALS.includes(intervalDays as 7 | 14)) {
    return { error: "Ungültiges Intervall." };
  }

  const desiredStart = new Date(desiredStartIso);
  const now = new Date();
  if (!isAtLeast24hAway(desiredStart, now)) {
    return {
      error: "Anfragen sind nur mindestens 24 Stunden im Voraus möglich.",
    };
  }

  // Profil (Puffer) + aktives Paket
  const { data: profile } = await supabase
    .from("profiles")
    .select("buffer_time_minutes, vorname, nachname, email")
    .eq("id", user.id)
    .maybeSingle();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  const { data: pkgs } = await supabase
    .from("packages")
    .select("*")
    .eq("student_id", user.id)
    .eq("status", "active");
  const pkg = (pkgs as Paket[] | null)?.find((p) => !canBuyNewPackage(p)) ?? null;
  if (!pkg) {
    return { error: "Du hast kein aktives Paket. Bitte buche zuerst ein Paket." };
  }
  const state = computePackageState(pkg);
  if (state.lessonsRemaining < lessonsCount) {
    return {
      error: `Dein Paket hat nur noch ${state.lessonsRemaining} Lektion${
        state.lessonsRemaining !== 1 ? "en" : ""
      }.`,
    };
  }

  // Serie gegen Engine validieren
  const admin = await createAdminClient();
  const starts = generateSeriesStarts(desiredStart, lessonsCount, intervalDays);
  const seriesEnd = new Date(starts[starts.length - 1].getTime() + 3600000);
  const ctx = await loadAvailabilityContext(
    admin,
    user.id,
    bufferMin,
    desiredStart,
    seriesEnd,
    now
  );
  const validation = validateSeries(desiredStart, lessonsCount, intervalDays, ctx);
  if (!validation.ok) {
    return {
      error:
        "Mindestens einer der gewünschten Termine ist nicht verfügbar. Bitte wähle einen anderen Zeitpunkt.",
    };
  }

  const calculatedPrice = lessonsCount * Number(pkg.price_per_lesson);

  const { error } = await supabase.from("booking_requests").insert({
    student_id: user.id,
    desired_start: desiredStart.toISOString(),
    status: "open",
    type: "public_request",
    lessons_count: lessonsCount,
    interval_days: intervalDays,
    calculated_price: calculatedPrice,
  });

  if (error) {
    return { error: "Anfrage konnte nicht gespeichert werden. Bitte erneut versuchen." };
  }

  // Outbox: Admin-Benachrichtigung + Bestätigung an Schüler
  const studentName = profile ? `${profile.vorname} ${profile.nachname}` : "Schüler";
  await enqueueEmail(admin, "booking_request_admin", {
    student_id: user.id,
    student_name: studentName,
    desired_start: desiredStart.toISOString(),
    lessons_count: lessonsCount,
    interval_days: intervalDays,
  });
  await enqueueEmail(admin, "booking_request_received", {
    student_id: user.id,
    to: profile?.email,
    desired_start: desiredStart.toISOString(),
    lessons_count: lessonsCount,
  });

  revalidatePath("/schueler/portal");
  return { success: true };
}

/** Schüler zieht eine offene Terminanfrage zurück (Spec §10.4). */
export async function withdrawBookingRequest(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: req } = await supabase
    .from("booking_requests")
    .select("id, status, student_id")
    .eq("id", requestId)
    .single();

  if (!req || req.student_id !== user.id) {
    return { error: "Anfrage nicht gefunden." };
  }
  if (req.status !== "open") {
    return { error: "Nur offene Anfragen können zurückgezogen werden." };
  }

  const { error } = await supabase
    .from("booking_requests")
    .update({ status: "withdrawn" })
    .eq("id", requestId);
  if (error) return { error: "Anfrage konnte nicht zurückgezogen werden." };

  const admin = await createAdminClient();
  await enqueueEmail(admin, "booking_request_withdrawn", {
    student_id: user.id,
    request_id: requestId,
  });

  revalidatePath("/schueler/portal");
  return { success: true };
}

/**
 * Schüler storniert einen bestätigten Termin (nur ≥24h vorher, Spec §10.4).
 * Update läuft über Service-Role, da appointments per RLS nur vom Admin
 * geändert werden dürfen; Eigentümerschaft + 24h werden serverseitig geprüft.
 */
export async function cancelAppointment(appointmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, start_at, student_id, status")
    .eq("id", appointmentId)
    .single();

  if (!appt || appt.student_id !== user.id) {
    return { error: "Termin nicht gefunden." };
  }
  if (appt.status === "cancelled") return { success: true };
  if (!isAtLeast24hAway(appt.start_at, new Date())) {
    return { error: "Stornierungen sind nur bis 24 Stunden vorher möglich." };
  }

  const admin = await createAdminClient();
  const { error } = await admin
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId);
  if (error) return { error: "Termin konnte nicht storniert werden." };

  await enqueueEmail(admin, "appointment_cancelled_by_student", {
    student_id: user.id,
    appointment_id: appointmentId,
    start_at: appt.start_at,
  });

  revalidatePath("/schueler/portal");
  return { success: true };
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
    status: "angefragt",
  });

  if (error) return { error: "Anfrage fehlgeschlagen. Bitte versuche es erneut." };

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
