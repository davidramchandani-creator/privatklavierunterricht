"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  type Package as Paket,
  PACKAGE_LABELS,
  PACKAGE_LESSONS,
  canBuyNewPackage,
  computePackageState,
  pricePerLessonFor,
} from "@/lib/packages";
import {
  type CalDate,
  DEFAULT_BUFFER_MIN,
  addDaysCal,
  generateSeriesStarts,
  isAtLeast24hAway,
  utcToZonedDate,
  validateSeries,
  weekdayOf,
  zonedToUtc,
} from "@/lib/booking";
import { loadAvailabilityContext } from "@/lib/booking-server";
import { gapAwareSlots, isGapAwareStartBookable, DEFAULT_BLOCK_SETTINGS } from "@/lib/booking-gap";
import { sendEmailNow } from "@/lib/emails-outbox";
import { createInstalmentSchedule, createPackageInvoice } from "@/lib/package-invoice";
import {
  CANCELLATION_NOTICE_DAYS,
  isCancellable,
  todayInZurich,
} from "@/lib/subscription";
import {
  buildPlanForRhythmus,
  expiryFor,
  FLEX_SURCHARGE_PERCENT,
  priceWithBookingMode,
  termMonthsForType,
  type BookingMode,
  type Rhythmus,
} from "@/lib/rhythmus";
import { describeFixplatz } from "@/lib/fixplatz";
import { bookFixplatzSeries } from "@/lib/fixplatz-server";
import { findeFixplaetze, type FixplatzAngebot } from "@/lib/fixplatz-suche";
import {
  bookingLock,
  bookingLockReason,
  type InstalmentRow,
} from "@/lib/instalment-view";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { cancelLessonReminders } from "@/lib/reminders";
import { bookSeriesForStudent } from "@/lib/series-booking";
import {
  joinGroupSession,
  leaveGroupSession,
} from "@/lib/group-booking";
import {
  type GroupCourse,
  pricePerPersonFor,
} from "@/lib/group-courses";

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

  const settings =
    (ctx as { blockSettings?: typeof DEFAULT_BLOCK_SETTINGS }).blockSettings ??
    DEFAULT_BLOCK_SETTINGS;

  return gapAwareSlots(fromCal, 7, ctx, settings).map((s) => ({
    beginn: s.start.toISOString(),
    ende: s.end.toISOString(),
  }));
}

/**
 * Schüler stellt mehrere Einzelterminanfragen auf einmal (neue Multi-Slot-Variante,
 * Spec §4.1). Jeder Slot wird einzeln gegen die Engine validiert und bekommt eine
 * eigene Zeile in booking_requests. Alle Slots der gleichen Einreichung teilen
 * dieselbe group_id, damit der Admin sie gebündelt sehen und einzeln entscheiden kann.
 */
/**
 * Prüft die Buchungssperre bei Ratenkauf: Erst wenn die Anzahlung bestätigt
 * bezahlt ist, darf gebucht werden. Wird serverseitig erzwungen, damit die
 * Regel auch bei umgangener UI greift.
 */
async function assertBookingUnlocked(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pkg: { id: string; billing_mode?: string | null }
): Promise<{ error: string } | null> {
  if (pkg.billing_mode !== "raten") return null;

  const { data: rows } = await supabase
    .from("package_instalments")
    .select("id, sequence, kind, amount, due_date, status, invoice_id, paid_at")
    .eq("package_id", pkg.id)
    .order("sequence", { ascending: true });

  const lock = bookingLock(pkg.billing_mode, (rows ?? []) as InstalmentRow[]);
  if (!lock.locked) return null;
  return { error: bookingLockReason(lock) ?? "Buchung noch nicht freigegeben." };
}

export async function requestMultipleBookings(desiredStartIsos: string[]) {
  if (!desiredStartIsos.length) return { error: "Keine Termine ausgewählt." };
  if (desiredStartIsos.length > 20) return { error: "Maximal 20 Termine pro Anfrage." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

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
  if (!pkg) return { error: "Du hast kein aktives Paket. Bitte buche zuerst ein Paket." };

  const gesperrt = await assertBookingUnlocked(supabase, pkg);
  if (gesperrt) return gesperrt;

  const state = computePackageState(pkg);
  if (state.lessonsRemaining < desiredStartIsos.length) {
    return {
      error: `Dein Paket hat nur noch ${state.lessonsRemaining} Lektion${
        state.lessonsRemaining !== 1 ? "en" : ""
      } übrig.`,
    };
  }

  const now = new Date();

  // Jeden Slot einzeln gegen 24h-Regel + Engine prüfen
  const admin = await createAdminClient();
  for (const iso of desiredStartIsos) {
    const desiredStart = new Date(iso);
    if (!isAtLeast24hAway(desiredStart, now)) {
      return {
        error: `Termine müssen mindestens 24 Stunden im Voraus angefragt werden (${desiredStart.toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}).`,
      };
    }
    const slotEnd = new Date(desiredStart.getTime() + 3600000);
    const ctx = await loadAvailabilityContext(admin, user.id, bufferMin, desiredStart, slotEnd, now);
    const settings =
      (ctx as { blockSettings?: typeof DEFAULT_BLOCK_SETTINGS }).blockSettings ??
      DEFAULT_BLOCK_SETTINGS;
    // Nie dem Client vertrauen: exakt dieselbe Prüfung wie bei der Anzeige.
    if (!isGapAwareStartBookable(desiredStart, ctx, settings)) {
      return {
        error: `Der Slot ${desiredStart.toLocaleString("de-CH", { timeZone: "Europe/Zurich" })} ist nicht verfügbar. Bitte wähle einen anderen Zeitpunkt.`,
      };
    }
  }

  const groupId =
    desiredStartIsos.length > 1 ? crypto.randomUUID() : null;

  const calculatedPrice = Number(pkg.price_per_lesson ?? 0);

  const rows = desiredStartIsos.map((iso) => ({
    student_id: user.id,
    desired_start: iso,
    status: "open",
    type: "public_request",
    lessons_count: 1,
    interval_days: 0,
    calculated_price: calculatedPrice,
    group_id: groupId,
  }));

  const { error } = await supabase.from("booking_requests").insert(rows);
  if (error) {
    console.error("[requestMultipleBookings] insert error:", error);
    return { error: "Anfrage konnte nicht gespeichert werden. Bitte erneut versuchen." };
  }

  const studentName = profile ? `${profile.vorname} ${profile.nachname}` : "Schüler";
  const sortedStarts = [...desiredStartIsos].sort();

  // Eine gemeinsame Mail für alle Slots (nicht N einzelne Mails)
  await sendEmailNow(admin, "booking_request_admin", {
    student_id: user.id,
    student_name: studentName,
    desired_starts: sortedStarts,
    lessons_count: desiredStartIsos.length,
  });
  await sendEmailNow(admin, "booking_request_received", {
    student_id: user.id,
    to: profile?.email,
    desired_starts: sortedStarts,
    lessons_count: desiredStartIsos.length,
  });

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
}

/** Schüler zieht alle offenen Anfragen einer Gruppe auf einmal zurück. */
export async function withdrawGroupBookingRequests(groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  // Nur eigene Anfragen der Gruppe zurückziehen
  const { error } = await supabase
    .from("booking_requests")
    .update({ status: "withdrawn" })
    .eq("group_id", groupId)
    .eq("student_id", user.id)
    .eq("status", "open");
  if (error) return { error: "Anfragen konnten nicht zurückgezogen werden." };

  const admin = await createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("vorname, nachname")
    .eq("id", user.id)
    .maybeSingle();
  await sendEmailNow(admin, "booking_request_withdrawn", {
    student_id: user.id,
    student_name: profile ? `${profile.vorname} ${profile.nachname}` : undefined,
    group_id: groupId,
  });

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
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
  await sendEmailNow(admin, "booking_request_withdrawn", {
    student_id: user.id,
    request_id: requestId,
  });

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
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
  if (appt.status === "cancelled") return { success: true, error: undefined };
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

  // Geplante Termin-Erinnerungen abbrechen.
  await cancelLessonReminders(admin, appointmentId);

  // Offene Rechnung zu diesem Termin archivieren + geplante Zahlungsmail abbrechen
  // (Spec §6: bei Terminabsage Rechnung archivieren; Invoice-Status kennt kein "cancelled").
  const { data: cancelledInvoices } = await admin
    .from("invoices")
    .update({ status: "archived" })
    .eq("appointment_id", appointmentId)
    .in("status", ["unpaid", "pending_confirmation", "rejected"])
    .select("id");

  // Zahlungsmails via appointment_id abbrechen (deckt auch Fälle ohne invoice_id ab).
  await admin
    .from("scheduled_emails")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .contains("payload", { appointment_id: appointmentId });

  if (cancelledInvoices?.length) {
    const invoiceIds = cancelledInvoices.map((i: { id: string }) => i.id);
    for (const invId of invoiceIds) {
      await admin
        .from("scheduled_emails")
        .update({ status: "cancelled" })
        .eq("status", "pending")
        .contains("payload", { invoice_id: invId });
    }
  }

  // Sofortversand: Mail an Admin (Info) + Bestätigung an Schüler (Spec §9).
  await sendEmailNow(admin, "appointment_cancelled_by_student", {
    student_id: user.id,
    appointment_id: appointmentId,
    start_at: appt.start_at,
  });
  await sendEmailNow(admin, "appointment_cancelled_student", {
    student_id: user.id,
    appointment_id: appointmentId,
    start_at: appt.start_at,
  });

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
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
  await sendEmailNow(admin, "reschedule_request_admin", {
    student_id: user.id,
    student_name: studentName,
    original_start: appt.start_at,
    proposed_start: newStart.toISOString(),
  });
  await sendEmailNow(admin, "reschedule_request_received", {
    student_id: user.id,
    to: profile?.email,
    original_start: appt.start_at,
    proposed_start: newStart.toISOString(),
  });

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
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
  await sendEmailNow(admin, "reschedule_request_withdrawn", {
    student_id: user.id,
    student_name: profile ? `${profile.vorname} ${profile.nachname}` : undefined,
    original_start: rr.original_start,
  });

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
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

  // Auch ein Admin-Vorschlag darf erst angenommen werden, wenn die
  // Anzahlung eines Ratenpakets bezahlt ist.
  const { data: aktivePakete } = await supabase
    .from("packages")
    .select("id, billing_mode")
    .eq("student_id", user.id)
    .eq("status", "active");
  for (const p of aktivePakete ?? []) {
    const gesperrt = await assertBookingUnlocked(supabase, p);
    if (gesperrt) return gesperrt;
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
    await sendEmailNow(admin, "booking_confirmed", {
      to: profile.email,
      starts,
      lessons_count: proposal.lessons_count ?? 1,
      interval_days: proposal.interval_days ?? 0,
    });
  }

  // Admin informieren, dass der Vorschlag angenommen wurde (Mail + Push).
  const { data: nameRow } = await supabase
    .from("profiles")
    .select("vorname, nachname")
    .eq("id", user.id)
    .maybeSingle();
  await sendEmailNow(admin, "proposal_accepted_admin", {
    student_id: user.id,
    student_name: nameRow ? `${nameRow.vorname} ${nameRow.nachname}` : undefined,
    proposed_start: proposal.proposed_start,
    lessons_count: proposal.lessons_count ?? 1,
    interval_days: proposal.interval_days ?? 0,
  });

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
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
  await sendEmailNow(admin, "proposal_rejected_admin", {
    student_id: user.id,
    student_name: profile ? `${profile.vorname} ${profile.nachname}` : undefined,
    proposed_start: proposal.proposed_start,
  });

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
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
  const { data: updated, error } = await admin
    .from("invoices")
    .update({ status: "pending_confirmation" })
    .eq("id", invoiceId)
    .select("amount, invoice_number, lesson_date")
    .maybeSingle();
  if (error) return { error: "Status konnte nicht aktualisiert werden." };

  // Admin informieren, damit die Zahlung geprüft werden kann (Mail + Push).
  const { data: profile } = await supabase
    .from("profiles")
    .select("vorname, nachname")
    .eq("id", user.id)
    .maybeSingle();
  await sendEmailNow(admin, "payment_reported_admin", {
    student_id: user.id,
    student_name: profile ? `${profile.vorname} ${profile.nachname}` : undefined,
    invoice_id: invoiceId,
    amount: updated?.amount,
    invoice_number: updated?.invoice_number,
    lesson_date: updated?.lesson_date,
  });

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
}

/**
 * Schüler bucht ein neues Paket (10er oder 20er) im Portal.
 * Preis wird serverseitig aus dem Profil berechnet – nie aus dem Client
 * übernommen. Insert läuft über den Service-Role-Client, da die RLS auf
 * `packages` nur Admin-Inserts erlaubt; sämtliche Geschäftsregeln werden
 * vorher serverseitig geprüft.
 */
export type BuyPackageOptions = {
  /** "einmalig" = Gesamtbetrag sofort, "raten" = 25 % Anzahlung + Monatsraten. */
  billingMode?: "einmalig" | "raten";
  /** Opt-in: Paket verlängert sich am Ende der Laufzeit automatisch. */
  autoRenew?: boolean;
  /** Bestimmt die Laufzeit: wöchentlich kürzer, zweiwöchentlich länger. */
  rhythmus?: Rhythmus;
  /** "fix" = fester Slot über die ganze Laufzeit, "flex" = freie Buchung. */
  bookingMode?: BookingMode;
  /** Nur bei bookingMode "fix": der gewünschte feste Platz. */
  fixplatz?: {
    weekday: number;
    /** "HH:MM" */
    time: string;
    parity: 0 | 1 | null;
  };
};

/**
 * Freie Fixplätze für den angemeldeten Schüler.
 *
 * Geprüft wird die **ganze Serie** über die Paketlaufzeit, nicht nur der
 * nächste Termin. Ein Platz, der nächste Woche frei ist, aber ab Oktober
 * jedes zweite Mal kollidiert, taugt nicht als fester Platz.
 */
export async function fixplaetzeSuchen(
  type: "10er" | "20er",
  rhythmus: Rhythmus
): Promise<{ angebote: FixplatzAngebot[] } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  if (type !== "10er" && type !== "20er") return { error: "Ungültiger Pakettyp." };

  const admin = await createAdminClient();
  const angebote = await findeFixplaetze(admin, {
    studentId: user.id,
    rhythmus: rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich",
    lessons: PACKAGE_LESSONS[type],
  });

  return { angebote };
}

export async function buyPackage(
  type: "10er" | "20er",
  agbAccepted: boolean,
  options: BuyPackageOptions = {}
) {
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
    .select("id, role, price_single, price_10er, price_20er, travel_surcharge, vorname, nachname, adresse, email, payment_method")
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

  // Rhythmus und Buchungsart bestimmen Laufzeit und Preis.
  const rhythmus: Rhythmus =
    options.rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich";
  const bookingMode: BookingMode = options.bookingMode === "fix" ? "fix" : "flex";

  if (bookingMode === "fix" && !options.fixplatz) {
    return { error: "Bitte wähle einen festen Termin aus." };
  }

  const basisPreis = pricePerLessonFor(type, {
    price_single: Number(profile.price_single),
    price_10er: Number(profile.price_10er),
    price_20er: Number(profile.price_20er),
    travel_surcharge: Number(profile.travel_surcharge),
  });
  // Flex kostet Aufschlag: wechselnde Termine zerstören die Routenplanung
  // und erzeugen laufenden Verwaltungsaufwand.
  const ppl = priceWithBookingMode(basisPreis, bookingMode);
  const totalPrice = ppl * lessonsTotal;
  const flexAufschlag = bookingMode === "flex" ? FLEX_SURCHARGE_PERCENT : 0;

  const startsAt = new Date();
  const startDay = todayInZurich(startsAt);
  const termMonths = termMonthsForType(type, rhythmus);
  const expiresOn = expiryFor(lessonsTotal, rhythmus, startDay);
  const expiresAt = new Date(`${expiresOn}T23:59:59.000Z`);

  // Zahlungsmodus: Ratenkauf nur für 10er/20er, Laufzeit = Gültigkeit.
  const billingMode = options.billingMode === "raten" ? "raten" : "einmalig";
  const autoRenew = options.autoRenew === true;
  const ratenPlan =
    billingMode === "raten"
      ? buildPlanForRhythmus(type, totalPrice, startDay, rhythmus)
      : null;

  const admin = await createAdminClient();
  const { data: pkg, error } = await admin
    .from("packages")
    .insert({
      student_id: user.id,
      type,
      lessons_total: lessonsTotal,
      lessons_used: 0,
      name: PACKAGE_LABELS[type],
      price_per_lesson: ppl,
      total_price: totalPrice,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: "active",
      billing_mode: billingMode,
      // term_months ist als smallint angelegt; gebrochene Laufzeiten gibt es
      // nur nach einem Rhythmuswechsel, beim Kauf ist der Wert immer ganz.
      term_months: Math.round(termMonths),
      auto_renew: autoRenew,
      deposit_amount: ratenPlan ? ratenPlan.depositAmount : null,
      instalment_count: ratenPlan ? ratenPlan.instalmentCount : null,
      instalment_amount: ratenPlan ? ratenPlan.instalmentAmount : null,
      rhythmus,
      booking_mode: bookingMode,
      fixplatz_weekday: options.fixplatz?.weekday ?? null,
      fixplatz_time: options.fixplatz?.time ?? null,
      fixplatz_week_parity: options.fixplatz?.parity ?? null,
      flex_surcharge_percent: flexAufschlag,
    })
    .select("id, student_id, type, total_price, price_per_lesson, payment_method")
    .single();

  if (error || !pkg) {
    // 23505 = unique_violation: der partielle Unique-Index
    // `packages_one_active_per_student` verhindert ein zweites aktives Paket
    // (z. B. bei Doppelklick oder parallelen Requests).
    if (error?.code === "23505") {
      return { error: "Du hast bereits ein aktives Paket." };
    }
    return { error: "Paket konnte nicht gebucht werden. Bitte versuche es erneut." };
  }

  const payer = {
    vorname: profile.vorname,
    nachname: profile.nachname,
    adresse: profile.adresse,
    email: profile.email,
    payment_method: profile.payment_method,
  };

  if (ratenPlan) {
    // Ratenkauf: kompletten Plan anlegen, sofort nur die Anzahlung
    // fakturieren. Die Monatsraten stellt der Tagesjob am Stichtag.
    await createInstalmentSchedule(admin, pkg, payer, {
      type,
      totalPrice,
      startDate: startDay,
      rhythmus,
    });
  } else {
    // Einmalzahlung: Gesamtpreis sofort in Rechnung stellen (15 Tage Frist).
    await createPackageInvoice(admin, pkg, payer);
  }

  // Fixplatz: die ganze Terminserie sofort anlegen. Das ist der eigentliche
  // Nutzen für beide Seiten – der Schüler muss nie wieder einzeln buchen,
  // und die Route steht für Monate fest.
  //
  // Bei Ratenzahlung wird bewusst trotzdem gebucht: der feste Platz ist das,
  // was der Schüler kauft, und ihn bis zum Zahlungseingang freizulassen hiesse,
  // ihn an jemand anderen zu verlieren. Die Buchungssperre bei offener
  // Anzahlung greift nur für *zusätzliche* Termine.
  let fixplatzInfo: {
    text: string;
    termine: string[];
    verschoben: { original: string; ersatz: string }[];
    offen: string[];
  } | null = null;

  if (bookingMode === "fix" && options.fixplatz) {
    const ergebnis = await bookFixplatzSeries(admin, {
      studentId: user.id,
      packageId: pkg.id,
      wunsch: {
        weekday: options.fixplatz.weekday,
        time: options.fixplatz.time,
        rhythmus,
        lessons: lessonsTotal,
      },
      parity: options.fixplatz.parity,
    });

    if ("error" in ergebnis) {
      // Das Paket bleibt bestehen – die Lektionen sind bezahlt und
      // gutgeschrieben. Nur die Serie fehlt, das kann der Admin nachholen.
      // Ein Rollback wäre schlechter: der Schüler stünde ohne Paket da,
      // obwohl die Rechnung schon draussen ist.
      await sendEmailNow(admin, "fixplatz_admin", {
        student_id: user.id,
        student_name:
          `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim() || undefined,
        fixplatz_text: `${describeFixplatz(
          options.fixplatz.weekday,
          options.fixplatz.time,
          rhythmus,
          options.fixplatz.parity
        )} – Serie konnte nicht angelegt werden: ${ergebnis.error}`,
        anzahl_termine: 0,
        anzahl_offen: lessonsTotal,
      });
    } else {
      const { data: termine } = await admin
        .from("appointments")
        .select("start_at")
        .in("id", ergebnis.appointmentIds)
        .order("start_at");

      fixplatzInfo = {
        text: describeFixplatz(
          options.fixplatz.weekday,
          options.fixplatz.time,
          rhythmus,
          options.fixplatz.parity
        ),
        termine: (termine ?? []).map((t) => t.start_at as string),
        verschoben: ergebnis.verschoben.map((v) => ({
          original: v.original.toISOString(),
          ersatz: v.ersatz.toISOString(),
        })),
        offen: ergebnis.offen.map((d) => d.toISOString()),
      };

      await sendEmailNow(admin, "fixplatz_confirmed", {
        student_id: user.id,
        student_name:
          `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim() || undefined,
        fixplatz_text: fixplatzInfo.text,
        termine: fixplatzInfo.termine,
        verschoben: fixplatzInfo.verschoben,
        offen: fixplatzInfo.offen,
      });

      await sendEmailNow(admin, "fixplatz_admin", {
        student_id: user.id,
        student_name:
          `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim() || undefined,
        fixplatz_text: fixplatzInfo.text,
        anzahl_termine: fixplatzInfo.termine.length,
        anzahl_verschoben: fixplatzInfo.verschoben.length,
        anzahl_offen: fixplatzInfo.offen.length,
      });
    }
  }

  // Paketbestätigung an den Schüler – erklärt, was als Nächstes zu tun ist.
  await sendEmailNow(admin, "package_created", {
    student_id: user.id,
    student_name: `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim() || undefined,
    package_label: PACKAGE_LABELS[type],
    lessons_total: lessonsTotal,
    total_price: totalPrice,
    billing_mode: billingMode,
    deposit_amount: ratenPlan?.depositAmount,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    plan: ratenPlan
      ? ratenPlan.entries.map((e) => ({
          label: e.kind === "anzahlung" ? "Anzahlung" : `Rate ${e.sequence}`,
          amount: e.amount,
          dueDate: e.dueDate,
        }))
      : null,
  });

  // Admin über den Paketkauf informieren (Mail + Push).
  await sendEmailNow(admin, "package_purchased_admin", {
    student_id: user.id,
    student_name: `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim() || undefined,
    package_label: PACKAGE_LABELS[type],
    lessons_total: lessonsTotal,
    price_per_lesson: ppl,
    total_price: totalPrice,
    billing_mode: billingMode,
    deposit_amount: ratenPlan?.depositAmount,
    instalment_count: ratenPlan?.instalmentCount,
    instalment_amount: ratenPlan?.instalmentAmount,
    auto_renew: autoRenew,
    rhythmus,
    booking_mode: bookingMode,
  });

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
}

/**
 * Auto-Verlängerung für das eigene Paket ein- oder ausschalten.
 *
 * Das ist gleichzeitig die Kündigung: wer abwählt, dessen Paket läuft am
 * Ende der Laufzeit ersatzlos aus. Nach Ablauf der Kündigungsfrist
 * (14 Tage vor Verfall) ist die laufende Periode nicht mehr kündbar –
 * die Verlängerung ist dann bereits ausgelöst.
 */
export async function setAutoRenew(packageId: string, enabled: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: pkg } = await supabase
    .from("packages")
    .select("id, student_id, status, expires_at, auto_renew, type")
    .eq("id", packageId)
    .maybeSingle();

  if (!pkg || pkg.student_id !== user.id) {
    return { error: "Paket nicht gefunden." };
  }
  if (pkg.status !== "active") {
    return { error: "Dieses Paket ist nicht mehr aktiv." };
  }

  // Kündigungsfrist prüfen – nur beim Abwählen relevant.
  if (!enabled && pkg.expires_at) {
    const expiresOn = todayInZurich(new Date(pkg.expires_at));
    if (!isCancellable(expiresOn, todayInZurich())) {
      return {
        error: `Die Kündigungsfrist von ${CANCELLATION_NOTICE_DAYS} Tagen ist abgelaufen. Melde dich bitte direkt bei mir.`,
      };
    }
  }

  const admin = await createAdminClient();
  const { error } = await admin
    .from("packages")
    .update({
      auto_renew: enabled,
      cancelled_at: enabled ? null : new Date().toISOString(),
    })
    .eq("id", packageId);

  if (error) return { error: "Änderung konnte nicht gespeichert werden." };

  // Kündigung bestätigen – Schüler und Admin (Mail + Push).
  if (!enabled) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("vorname, nachname")
      .eq("id", user.id)
      .maybeSingle();
    const studentName =
      `${prof?.vorname ?? ""} ${prof?.nachname ?? ""}`.trim() || undefined;
    const label = PACKAGE_LABELS[pkg.type as string] ?? "Paket";

    await sendEmailNow(admin, "subscription_cancelled", {
      student_id: user.id,
      student_name: studentName,
      package_id: pkg.id,
      package_label: label,
      expires_at: pkg.expires_at,
    });
    await sendEmailNow(admin, "subscription_cancelled_admin", {
      student_id: user.id,
      student_name: studentName,
      package_id: pkg.id,
      package_label: label,
      expires_at: pkg.expires_at,
    });
  }

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
}

// ── Gruppenkurse ───────────────────────────────────────────────────────────

export type GroupSessionVM = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  participant_count: number;
  max_participants: number;
  free_seats: number;
  /** Preis pro Person, wenn ich beitrete (count + 1). */
  join_price: number;
  is_mine: boolean;
};

export type GroupCourseVM = {
  id: string;
  title: string;
  description: string | null;
  max_participants: number;
  long_duration_from: number;
  long_minutes: number;
  short_minutes: number;
  min_price_per_person: number;
  price_tiers: Record<string, number>;
  open_sessions: GroupSessionVM[];
};

/** Aktive Gruppenkurse + ihre offenen Sessionen (mit Teilnehmerzahl/Preis). */
export async function getGroupCourses(): Promise<GroupCourseVM[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = await createAdminClient();
  const { data: courses } = await admin
    .from("group_courses")
    .select("*")
    .eq("status", "active")
    .order("title", { ascending: true });
  if (!courses?.length) return [];

  const nowIso = new Date().toISOString();
  const { data: sessions } = await admin
    .from("group_sessions")
    .select("id, course_id, start_at, end_at, status")
    .in("status", ["open", "full"])
    .gte("start_at", nowIso)
    .order("start_at", { ascending: true });

  // Teilnehmer je Session (booked/completed) zählen.
  const sessionIds = (sessions ?? []).map((s) => s.id);
  const countBySession = new Map<string, number>();
  const mineSessions = new Set<string>();
  if (sessionIds.length) {
    const { data: appts } = await admin
      .from("appointments")
      .select("group_session_id, student_id")
      .in("group_session_id", sessionIds)
      .in("status", ["booked", "completed"]);
    for (const a of appts ?? []) {
      const sid = a.group_session_id as string;
      countBySession.set(sid, (countBySession.get(sid) ?? 0) + 1);
      if (a.student_id === user.id) mineSessions.add(sid);
    }
  }

  return (courses as GroupCourse[]).map((c) => {
    const open = (sessions ?? [])
      .filter((s) => s.course_id === c.id)
      .map((s) => {
        const count = countBySession.get(s.id) ?? 0;
        return {
          id: s.id,
          start_at: s.start_at,
          end_at: s.end_at,
          status: s.status,
          participant_count: count,
          max_participants: c.max_participants,
          free_seats: c.max_participants - count,
          join_price: pricePerPersonFor(c, count + 1),
          is_mine: mineSessions.has(s.id),
        };
      })
      // Volle Sessionen, bei denen ich nicht dabei bin, ausblenden.
      .filter((s) => s.is_mine || s.participant_count < c.max_participants);
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      max_participants: c.max_participants,
      long_duration_from: c.long_duration_from,
      long_minutes: c.long_minutes,
      short_minutes: c.short_minutes,
      min_price_per_person: pricePerPersonFor(c, 1),
      price_tiers: c.price_tiers,
      open_sessions: open,
    };
  });
}

export async function joinGroupSessionAction(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const admin = await createAdminClient();
  const result = await joinGroupSession(admin, user.id, sessionId);
  if ("error" in result) return result;

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
}

export async function leaveGroupSessionAction(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const admin = await createAdminClient();
  const result = await leaveGroupSession(admin, user.id, sessionId);
  if ("error" in result) return result;

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
}
