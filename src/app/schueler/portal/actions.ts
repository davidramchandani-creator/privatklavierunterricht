"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { addMonths } from "@/lib/utils";
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
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { bookSeriesForStudent } from "@/lib/series-booking";

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

  return computeAvailableSlots(fromCal, 7, ctx).map((s) => ({
    beginn: s.start.toISOString(),
    ende: s.end.toISOString(),
  }));
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

  // Google Calendar: Event löschen
  await deleteCalendarEvent(admin, appointmentId);

  // Offene Rechnung zu diesem Termin stornieren
  await admin
    .from("invoices")
    .update({ status: "cancelled" })
    .eq("appointment_id", appointmentId)
    .in("status", ["unpaid", "pending_confirmation", "rejected"]);

  // Mail an Admin (Info) UND Bestätigung an den Schüler (Spec §9).
  await enqueueEmail(admin, "appointment_cancelled_by_student", {
    student_id: user.id,
    appointment_id: appointmentId,
    start_at: appt.start_at,
  });
  await enqueueEmail(admin, "appointment_cancelled_student", {
    student_id: user.id,
    appointment_id: appointmentId,
    start_at: appt.start_at,
  });

  revalidatePath("/schueler/portal");
  return { success: true };
}

/**
 * Schüler beantragt eine Verschiebung eines bestätigten Termins (Spec §6,
 * Meilenstein 6). Beide – der ursprüngliche wie der gewünschte neue Termin –
 * müssen ≥24h in der Zukunft liegen. Der Wunschslot wird gegen die Engine
 * validiert (der zu verschiebende Termin selbst wird dabei ausgenommen). Es
 * entsteht ein `reschedule_requests`-Eintrag (status open); der Termin wird
 * erst bei Admin-Bestätigung tatsächlich verschoben.
 */
export async function requestReschedule(
  appointmentId: string,
  newStartIso: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: appt } = await supabase
    .from("appointments")
    .select("id, start_at, end_at, student_id, status")
    .eq("id", appointmentId)
    .single();

  if (!appt || appt.student_id !== user.id) {
    return { error: "Termin nicht gefunden." };
  }
  if (appt.status !== "booked") {
    return { error: "Nur bestätigte Termine können verschoben werden." };
  }

  const now = new Date();
  if (!isAtLeast24hAway(appt.start_at, now)) {
    return {
      error: "Verschiebungen sind nur bis 24 Stunden vor dem Termin möglich.",
    };
  }

  const newStart = new Date(newStartIso);
  if (!isAtLeast24hAway(newStart, now)) {
    return {
      error: "Der neue Termin muss mindestens 24 Stunden in der Zukunft liegen.",
    };
  }

  // Bereits offene Verschiebung für diesen Termin? Dann nicht doppelt anlegen.
  const { data: existing } = await supabase
    .from("reschedule_requests")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("status", "open")
    .maybeSingle();
  if (existing) {
    return {
      error: "Für diesen Termin liegt bereits eine offene Verschiebung vor.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("buffer_time_minutes, vorname, nachname, email")
    .eq("id", user.id)
    .maybeSingle();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  // Wunschslot gegen die Engine validieren (eigenen Termin ausnehmen).
  const admin = await createAdminClient();
  const slotEnd = new Date(newStart.getTime() + 3600000);
  const ctx = await loadAvailabilityContext(
    admin,
    user.id,
    bufferMin,
    newStart,
    slotEnd,
    now,
    { excludeAppointmentId: appointmentId }
  );
  const validation = validateSeries(newStart, 1, 7, ctx);
  if (!validation.ok) {
    return {
      error:
        "Der gewünschte neue Zeitpunkt ist nicht verfügbar. Bitte wähle einen anderen.",
    };
  }

  const { error } = await supabase.from("reschedule_requests").insert({
    student_id: user.id,
    appointment_id: appointmentId,
    original_start: appt.start_at,
    proposed_start: newStart.toISOString(),
    status: "open",
    request_type: "reschedule",
  });
  if (error) {
    return { error: "Verschiebung konnte nicht gespeichert werden." };
  }

  const studentName = profile ? `${profile.vorname} ${profile.nachname}` : "Schüler";
  await enqueueEmail(admin, "reschedule_request_admin", {
    student_id: user.id,
    student_name: studentName,
    original_start: appt.start_at,
    proposed_start: newStart.toISOString(),
  });
  await enqueueEmail(admin, "reschedule_request_received", {
    student_id: user.id,
    to: profile?.email,
    original_start: appt.start_at,
    proposed_start: newStart.toISOString(),
  });

  revalidatePath("/schueler/portal");
  return { success: true };
}

/** Schüler zieht eine offene Verschiebungsanfrage zurück. */
export async function withdrawReschedule(rescheduleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: rr } = await supabase
    .from("reschedule_requests")
    .select("id, status, student_id, original_start")
    .eq("id", rescheduleId)
    .single();

  if (!rr || rr.student_id !== user.id) {
    return { error: "Anfrage nicht gefunden." };
  }
  if (rr.status !== "open") {
    return { error: "Nur offene Anfragen können zurückgezogen werden." };
  }

  const { error } = await supabase
    .from("reschedule_requests")
    .update({ status: "withdrawn" })
    .eq("id", rescheduleId);
  if (error) return { error: "Anfrage konnte nicht zurückgezogen werden." };

  // Admin über das Zurückziehen informieren (Spec §9).
  const admin = await createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("vorname, nachname")
    .eq("id", user.id)
    .maybeSingle();
  await enqueueEmail(admin, "reschedule_request_withdrawn", {
    student_id: user.id,
    student_name: profile ? `${profile.vorname} ${profile.nachname}` : undefined,
    original_start: rr.original_start,
  });

  revalidatePath("/schueler/portal");
  return { success: true };
}

/**
 * Schüler nimmt einen Terminvorschlag des Admins an (Spec §4, Flow 2).
 * Bucht die Termine über die gemeinsame Serien-Logik (Rechnung + Zahlungsmail
 * + Calendar-Sync) und setzt den Vorschlag auf accepted.
 */
export async function acceptProposal(proposalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, student_id, status, proposed_start, lessons_count, interval_days")
    .eq("id", proposalId)
    .single();

  if (!proposal || proposal.student_id !== user.id) {
    return { error: "Vorschlag nicht gefunden." };
  }
  if (proposal.status !== "open") {
    return { error: "Dieser Vorschlag ist nicht mehr offen." };
  }

  const admin = await createAdminClient();
  const result = await bookSeriesForStudent(
    admin,
    user.id,
    new Date(proposal.proposed_start).toISOString(),
    proposal.lessons_count ?? 1,
    proposal.interval_days ?? 7,
    "admin_proposal"
  );
  if ("error" in result) return result;

  await admin
    .from("proposals")
    .update({ status: "accepted" })
    .eq("id", proposalId);

  // Bestätigung an den Schüler (gleiches Template wie Anfrage-Annahme).
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.email) {
    const starts = generateSeriesStarts(
      new Date(proposal.proposed_start),
      proposal.lessons_count ?? 1,
      proposal.interval_days ?? 7
    ).map((d) => d.toISOString());
    await enqueueEmail(admin, "booking_confirmed", {
      to: profile.email,
      starts,
      lessons_count: proposal.lessons_count ?? 1,
      interval_days: proposal.interval_days ?? 0,
    });
  }

  revalidatePath("/schueler/portal");
  return { success: true };
}

/** Schüler lehnt einen Terminvorschlag ab → Admin wird informiert. */
export async function rejectProposal(proposalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, student_id, status, proposed_start")
    .eq("id", proposalId)
    .single();

  if (!proposal || proposal.student_id !== user.id) {
    return { error: "Vorschlag nicht gefunden." };
  }
  if (proposal.status !== "open") {
    return { error: "Dieser Vorschlag ist nicht mehr offen." };
  }

  const { error } = await supabase
    .from("proposals")
    .update({ status: "rejected" })
    .eq("id", proposalId);
  if (error) return { error: "Vorschlag konnte nicht abgelehnt werden." };

  const admin = await createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("vorname, nachname")
    .eq("id", user.id)
    .maybeSingle();
  await enqueueEmail(admin, "proposal_rejected_admin", {
    student_id: user.id,
    student_name: profile ? `${profile.vorname} ${profile.nachname}` : undefined,
    proposed_start: proposal.proposed_start,
  });

  revalidatePath("/schueler/portal");
  return { success: true };
}

/**
 * Schüler markiert eine Rechnung als bezahlt (unpaid/rejected → pending_confirmation).
 * Nur für eigene Rechnungen. Spec §6.
 */
export async function markInvoicePaid(invoiceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  // Eigentümerschaft prüfen
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, student_id, status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!inv || inv.student_id !== user.id) {
    return { error: "Rechnung nicht gefunden." };
  }
  if (!["unpaid", "rejected"].includes(inv.status)) {
    return { error: "Nur unbezahlte oder abgelehnte Rechnungen können bestätigt werden." };
  }

  const admin = await createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({ status: "pending_confirmation" })
    .eq("id", invoiceId);
  if (error) return { error: "Status konnte nicht aktualisiert werden." };

  revalidatePath("/schueler/portal");
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
