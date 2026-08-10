"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  type Package as Paket,
  PACKAGE_LABELS,

  canBuyNewPackage,
  computePackageState,
} from "@/lib/packages";
import {
  type CalDate,
  DEFAULT_BUFFER_MIN,
  LESSON_DURATION_MIN,
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
import {
  CANCELLATION_NOTICE_DAYS,
  isCancellable,
  todayInZurich,
} from "@/lib/subscription";
import {
  FLEX_SURCHARGE_PERCENT,
  type BookingMode,
  type Rhythmus,
} from "@/lib/rhythmus";
import { findeAusweichtermine } from "@/lib/fixplatz-server";
import { meldeAusfall } from "@/lib/ausfall";
import { ladeOffeneRunde, ladeVerfuegbarkeit } from "@/lib/planung-server";
import { ladeFenster } from "@/lib/routing-server";
import {
  ABO_LABELS,
  type AboVariante,
} from "@/lib/abo";
import {
  baueVorschau,
  baueVorschauOhneTermin,
  legeMonatsratenAn,
  naechsterPeriodenstart,
  type AboVorschau,
} from "@/lib/abo-server";
import {
  bookingLock,
  bookingLockReason,
  type InstalmentRow,
} from "@/lib/instalment-view";
import { deleteCalendarEvent, syncAppointmentToCalendar } from "@/lib/google-calendar";
import { cancelLessonReminders, scheduleLessonReminders } from "@/lib/reminders";
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
    .select("id, start_at, student_id, status, package_id")
    .eq("id", appointmentId)
    .single();

  if (!appt || appt.student_id !== user.id) {
    return { error: "Termin nicht gefunden." };
  }
  if (appt.status === "cancelled") return { success: true, error: undefined };

  const jetzt = new Date();
  // Kurzfristige Absagen sind bewusst **erlaubt**, nicht blockiert.
  //
  // Vorher wurde unter 24 Stunden abgewiesen – wer morgens krank wurde,
  // konnte es über das System gar nicht mitteilen und musste anrufen. Die
  // Lektion gilt in diesem Fall trotzdem als gehalten; das entscheidet die
  // Ausfall-Logik, nicht diese Funktion.
  const kurzfristig = !isAtLeast24hAway(appt.start_at, jetzt);

  const admin = await createAdminClient();
  const { error } = await admin
    .from("appointments")
    .update({
      status: "cancelled",
      ausfall_verursacher: "schueler",
      ausfall_gemeldet_am: jetzt.toISOString(),
    })
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

  // Ausfall-Kaskade anstossen: sucht Ausweichtermine, schreibt bei
  // rechtzeitiger Absage eine Gutschrift, wenn nichts zu finden ist, und
  // verschickt die passende Mail. Sie entscheidet auch, ob die Lektion
  // erhalten bleibt oder als gehalten gilt.
  const ausfall = await meldeAusfall(admin, {
    appointmentId,
    studentId: user.id,
    packageId: appt.package_id ?? null,
    verursacher: "schueler",
    originalStart: new Date(appt.start_at),
    now: jetzt,
  });

  if ("error" in ausfall) {
    // Der Termin ist storniert – das ist der wichtigere Teil. Nur die
    // Kompensation fehlt; darüber wird der Admin ohnehin informiert.
    console.error("[ausfall] Kaskade fehlgeschlagen:", appointmentId, ausfall.error);
    await sendEmailNow(admin, "appointment_cancelled_by_student", {
      student_id: user.id,
      appointment_id: appointmentId,
      start_at: appt.start_at,
    });
  }

  revalidatePath("/schueler/portal");
  return {
    success: true,
    error: undefined,
    kurzfristig,
    vorschlaege: "error" in ausfall ? [] : ausfall.vorschlaege,
  };
}

/**
 * Offene Ausfälle des angemeldeten Schülers samt Ausweichvorschlägen.
 *
 * Bisher standen die Vorschläge nur in der E-Mail. Wer sie dort übersah,
 * hatte keine Möglichkeit mehr, einen Ersatztermin zu wählen.
 */
export async function offeneAusfaelle(): Promise<{
  ausfaelle: {
    id: string;
    originalStart: string;
    vorschlaege: { start: string; begruendung: string }[];
  }[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ausfaelle: [] };

  const { data: rows } = await supabase
    .from("lesson_ausfaelle")
    .select("id, appointment_id, original_start, status")
    .eq("student_id", user.id)
    .eq("status", "offen")
    .order("original_start");

  if (!rows || rows.length === 0) return { ausfaelle: [] };

  const admin = await createAdminClient();
  const ausfaelle = [];

  for (const r of rows) {
    const kandidaten = await findeAusweichtermine(admin, {
      studentId: user.id,
      originalStart: new Date(r.original_start as string),
      excludeAppointmentId: r.appointment_id as string,
    });
    ausfaelle.push({
      id: r.id as string,
      originalStart: r.original_start as string,
      vorschlaege: kandidaten.map((k) => ({
        start: k.slot.start.toISOString(),
        begruendung: k.begruendung,
      })),
    });
  }

  return { ausfaelle };
}

/**
 * Schüler wählt einen Ausweichtermin für eine ausgefallene Lektion.
 *
 * Der Slot wird serverseitig nochmals geprüft — zwischen dem Vorschlag in
 * der E-Mail und dem Klick können Tage liegen, in denen der Platz
 * anderweitig vergeben wurde.
 */
export async function ausweichterminWaehlen(
  ausfallId: string,
  startIso: string
): Promise<{ success: true; error: undefined } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: ausfall } = await supabase
    .from("lesson_ausfaelle")
    .select("id, student_id, package_id, appointment_id, original_start, status")
    .eq("id", ausfallId)
    .maybeSingle();

  if (!ausfall || ausfall.student_id !== user.id) {
    return { error: "Ausfall nicht gefunden." };
  }
  if (ausfall.status !== "offen") {
    return { error: "Für diese Lektion ist bereits ein Ersatz eingetragen." };
  }

  const admin = await createAdminClient();
  const gewuenscht = new Date(startIso);

  // Ist der Slot noch frei? Der Vorschlag kann alt sein.
  const kandidaten = await findeAusweichtermine(admin, {
    studentId: user.id,
    originalStart: new Date(ausfall.original_start as string),
    excludeAppointmentId: ausfall.appointment_id as string,
  });
  const passt = kandidaten.some(
    (k) => k.slot.start.getTime() === gewuenscht.getTime()
  );
  if (!passt) {
    return {
      error:
        "Dieser Termin ist inzwischen belegt. Bitte wähle einen der aktuellen Vorschläge.",
    };
  }

  const { data: erstellt, error } = await admin
    .from("appointments")
    .insert({
      student_id: user.id,
      package_id: ausfall.package_id,
      start_at: gewuenscht.toISOString(),
      end_at: new Date(
        gewuenscht.getTime() + LESSON_DURATION_MIN * 60000
      ).toISOString(),
      status: "booked",
      source: "reschedule",
      ersetzt_appointment_id: ausfall.appointment_id,
      notes: `Ausweichtermin für ${String(ausfall.original_start).slice(0, 10)}`,
    })
    .select("id, start_at")
    .single();

  if (error || !erstellt) {
    return { error: "Der Ausweichtermin konnte nicht gebucht werden." };
  }

  await admin
    .from("lesson_ausfaelle")
    .update({
      status: "ersatz_gebucht",
      ersatz_appointment_id: erstellt.id,
      erledigt_am: new Date().toISOString(),
    })
    .eq("id", ausfallId);

  await scheduleLessonReminders(admin, {
    id: erstellt.id,
    student_id: user.id,
    start_at: erstellt.start_at as string,
  });
  await syncAppointmentToCalendar(admin, erstellt.id);

  const { data: prof } = await admin
    .from("profiles")
    .select("vorname, nachname")
    .eq("id", user.id)
    .maybeSingle();

  await sendEmailNow(admin, "reschedule_confirmed", {
    to: undefined,
    student_id: user.id,
    student_name: `${prof?.vorname ?? ""} ${prof?.nachname ?? ""}`.trim() || undefined,
    original_start: ausfall.original_start,
    new_start: erstellt.start_at,
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

// ── Verfügbarkeit für die Planungsrunde ────────────────────

/**
 * Schüler trägt ein, wann er kann.
 *
 * Ersetzt jedes Mal alle Fenster dieser Runde, statt sie zu ergänzen — sonst
 * bliebe ein gelöschter Tag stehen und der Planer würde einen Termin
 * ansetzen, an dem der Schüler längst nicht mehr kann.
 */
export async function verfuegbarkeitSpeichern(params: {
  rundeId: string;
  fenster: {
    wochentag: number;
    fruehestens: string;
    spaetestens: string;
    praeferenz: number;
  }[];
  bemerkung: string | null;
}): Promise<{ success: true; error: undefined } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  if (params.fenster.length === 0) {
    return { error: "Bitte wähle mindestens einen Tag aus." };
  }

  const admin = await createAdminClient();

  const { data: runde } = await admin
    .from("planungsrunden")
    .select("id, status, frist")
    .eq("id", params.rundeId)
    .maybeSingle();

  if (!runde) return { error: "Diese Abfrage gibt es nicht mehr." };
  if (runde.status !== "offen") {
    return { error: "Diese Abfrage ist bereits abgeschlossen." };
  }

  for (const f of params.fenster) {
    if (f.wochentag < 0 || f.wochentag > 6) return { error: "Ungültiger Wochentag." };
    if (f.fruehestens >= f.spaetestens) {
      return { error: "Das Ende liegt vor dem Beginn." };
    }
    if (f.praeferenz < 1 || f.praeferenz > 3) {
      return { error: "Ungültige Präferenz." };
    }
  }

  await admin
    .from("student_verfuegbarkeit")
    .delete()
    .eq("student_id", user.id)
    .eq("runde_id", params.rundeId);

  const { error } = await admin.from("student_verfuegbarkeit").insert(
    params.fenster.map((f) => ({
      student_id: user.id,
      runde_id: params.rundeId,
      wochentag: f.wochentag,
      fruehestens: f.fruehestens,
      spaetestens: f.spaetestens,
      praeferenz: f.praeferenz,
    }))
  );
  if (error) return { error: "Die Zeiten konnten nicht gespeichert werden." };

  await admin.from("planungs_antworten").upsert(
    {
      runde_id: params.rundeId,
      student_id: user.id,
      geantwortet_am: new Date().toISOString(),
      bemerkung: params.bemerkung,
    },
    { onConflict: "runde_id,student_id" }
  );

  revalidatePath("/schueler/portal");
  return { success: true, error: undefined };
}

/** Die laufende Abfrage samt bereits eingetragener Zeiten. */
export async function offeneVerfuegbarkeitsabfrage(): Promise<{
  runde: { id: string; titel: string; frist: string } | null;
  fenster: { wochentag: number; beginn: string; ende: string }[];
  vorhanden: {
    wochentag: number;
    fruehestens: string;
    spaetestens: string;
    praeferenz: number;
  }[];
  bemerkung: string | null;
  geantwortet: boolean;
}> {
  const leer = {
    runde: null,
    fenster: [],
    vorhanden: [],
    bemerkung: null,
    geantwortet: false,
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return leer;

  const admin = await createAdminClient();
  const runde = await ladeOffeneRunde(admin);
  if (!runde) return leer;

  const [fenster, vorhanden, { data: antwort }] = await Promise.all([
    ladeFenster(admin),
    ladeVerfuegbarkeit(admin, user.id, runde.id),
    admin
      .from("planungs_antworten")
      .select("geantwortet_am, bemerkung")
      .eq("runde_id", runde.id)
      .eq("student_id", user.id)
      .maybeSingle(),
  ]);

  return {
    runde: { id: runde.id, titel: runde.titel, frist: runde.frist },
    fenster,
    vorhanden,
    bemerkung: (antwort?.bemerkung as string) ?? null,
    geantwortet: antwort?.geantwortet_am != null,
  };
}

// ── Abo ────────────────────────────────────────────────────

/**
 * Abo-Vorschau für den angemeldeten Schüler.
 *
 * Liefert die **exakten** Termine für den gewählten Fixplatz, die Ferien, die
 * darin ausfallen, und den Monatsbetrag. Bewusst serverseitig gerechnet: Der
 * Preis darf nie aus dem Browser kommen, und die Zahl in der Vorschau muss
 * dieselbe sein, die nachher auf der Rechnung steht.
 */
export async function aboVorschau(params: {
  variante: AboVariante;
  rhythmus: Rhythmus;
  bookingMode: BookingMode;
  /** Nur bei Fixplatz: Tage, an denen der Schüler kann. */
  moeglicheTage?: number[];
}): Promise<{ vorschau: AboVorschau } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  if (params.variante !== "halbjahr" && params.variante !== "jahr") {
    return { error: "Ungültige Abo-Variante." };
  }

  const rhythmus: Rhythmus =
    params.rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich";
  const periodeStart = naechsterPeriodenstart(todayInZurich());
  const admin = await createAdminClient();

  // Fixplatz: der Termin wird zugeteilt, der Wochentag steht also noch nicht
  // fest. Gerechnet wird mit dem ungünstigsten der möglichen Tage, damit der
  // genannte Preis in jedem Fall hält.
  if (params.bookingMode === "fix") {
    const tage = (params.moeglicheTage ?? []).filter((t) => t >= 0 && t <= 6);
    if (tage.length === 0) {
      return { error: "Bitte gib zuerst an, an welchen Tagen du kannst." };
    }
    const vorschau = await baueVorschauOhneTermin(admin, {
      studentId: user.id,
      variante: params.variante,
      rhythmus,
      moeglicheTage: tage,
      periodeStart,
    });
    return { vorschau };
  }

  // Flex: der Schüler bucht selbst, ein Referenztag genügt für die Rechnung.
  const vorschau = await baueVorschau(admin, {
    studentId: user.id,
    variante: params.variante,
    rhythmus,
    bookingMode: "flex",
    weekday: 3,
    periodeStart,
  });
  return { vorschau };
}

/**
 * Abo abschliessen.
 *
 * Der Schüler kauft eine Laufzeit (Halbjahr oder Jahr), nicht eine
 * Lektionszahl — wie viele Lektionen darin liegen, wird für seinen konkreten
 * Fixplatz ausgerechnet und vertraglich festgehalten.
 *
 * Alles Preisrelevante wird hier serverseitig neu berechnet und nichts aus dem
 * Client übernommen. Der Client schickt nur die Auswahl.
 */
export async function aboAbschliessen(params: {
  variante: AboVariante;
  rhythmus: Rhythmus;
  bookingMode: BookingMode;
  /**
   * Nur bei Fixplatz: wann der Schüler kann. Den konkreten Termin teilt
   * David zu — der Schüler wählt ihn bewusst nicht selbst.
   */
  verfuegbarkeiten?: {
    wochentag: number;
    fruehestens: string;
    spaetestens: string;
    praeferenz: number;
  }[];
  autoRenew: boolean;
  regelnBestaetigt: boolean;
}): Promise<{ success: true; error: undefined } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  if (!params.regelnBestaetigt) {
    return { error: "Bitte bestätige zuerst alle Punkte." };
  }
  if (params.variante !== "halbjahr" && params.variante !== "jahr") {
    return { error: "Ungültige Abo-Variante." };
  }

  const bookingMode: BookingMode = params.bookingMode === "fix" ? "fix" : "flex";
  const rhythmus: Rhythmus =
    params.rhythmus === "zweiwoechentlich" ? "zweiwoechentlich" : "woechentlich";

  const verfuegbarkeiten = (params.verfuegbarkeiten ?? []).filter(
    (v) =>
      v.wochentag >= 0 &&
      v.wochentag <= 6 &&
      v.fruehestens < v.spaetestens &&
      v.praeferenz >= 1 &&
      v.praeferenz <= 3
  );

  if (bookingMode === "fix" && verfuegbarkeiten.length === 0) {
    return { error: "Bitte gib an, an welchen Tagen du kannst." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, vorname, nachname, adresse, email, payment_method")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return { error: "Profil nicht gefunden." };

  const { data: bestehend } = await supabase
    .from("packages")
    .select("*")
    .eq("student_id", user.id)
    .eq("status", "active");

  const nutzbar = (bestehend ?? []).find((p) => !canBuyNewPackage(p as Paket));
  if (nutzbar) {
    return {
      error:
        "Du hast bereits ein laufendes Abo. Ein neues kannst du abschliessen, sobald das aktuelle endet.",
    };
  }

  const admin = await createAdminClient();
  const periodeStart = naechsterPeriodenstart(todayInZurich());

  // Fixplatz: Lektionszahl über den ungünstigsten der möglichen Tage, damit
  // der genannte Preis unabhängig von der späteren Zuteilung hält.
  const vorschau =
    bookingMode === "fix"
      ? await baueVorschauOhneTermin(admin, {
          studentId: user.id,
          variante: params.variante,
          rhythmus,
          moeglicheTage: [...new Set(verfuegbarkeiten.map((v) => v.wochentag))],
          periodeStart,
        })
      : await baueVorschau(admin, {
          studentId: user.id,
          variante: params.variante,
          rhythmus,
          bookingMode: "flex",
          weekday: 3,
          periodeStart,
        });

  if (vorschau.lektionen < 1) {
    return {
      error:
        "In diesem Zeitraum liegen keine Unterrichtstermine. Bitte melde dich bei mir.",
    };
  }

  const { data: pkg, error } = await admin
    .from("packages")
    .insert({
      student_id: user.id,
      type: params.variante === "halbjahr" ? "10er" : "20er",
      lessons_total: vorschau.lektionen,
      lessons_used: 0,
      name: `${ABO_LABELS[params.variante]} · ${
        rhythmus === "woechentlich" ? "wöchentlich" : "alle zwei Wochen"
      }`,
      price_per_lesson: vorschau.preisProLektion,
      total_price: vorschau.gesamtpreis,
      starts_at: new Date(`${periodeStart}T00:00:00.000Z`).toISOString(),
      expires_at: new Date(`${vorschau.periodeEnde}T23:59:59.000Z`).toISOString(),
      status: "active",
      billing_mode: "raten",
      term_months: vorschau.laufzeitMonate,
      auto_renew: params.autoRenew,
      deposit_amount: 0,
      instalment_count: vorschau.laufzeitMonate,
      instalment_amount: vorschau.monatsbetrag,
      rhythmus,
      booking_mode: bookingMode,
      // Beim Fixplatz bleibt der Termin offen, bis er zugeteilt wird.
      fixplatz_weekday: null,
      fixplatz_time: null,
      fixplatz_week_parity: null,
      flex_surcharge_percent: bookingMode === "flex" ? FLEX_SURCHARGE_PERCENT : 0,
      abo_variante: params.variante,
      abo_lektionen: vorschau.lektionen,
      monatsbetrag: vorschau.monatsbetrag,
      periode_start: periodeStart,
      periode_ende: vorschau.periodeEnde,
    })
    .select("id, student_id, type, total_price, price_per_lesson, payment_method")
    .single();

  if (error || !pkg) {
    if (error?.code === "23505") return { error: "Du hast bereits ein aktives Abo." };
    return { error: "Das Abo konnte nicht abgeschlossen werden." };
  }

  const raten = await legeMonatsratenAn(admin, {
    packageId: pkg.id,
    studentId: user.id,
    gesamtpreis: vorschau.gesamtpreis,
    laufzeitMonate: vorschau.laufzeitMonate,
    periodeStart,
  });
  if ("error" in raten) {
    console.error("[abo] Monatsraten:", pkg.id, raten.error);
  }

  // Verfügbarkeit für die Zuteilung ablegen. Ohne offene Runde als
  // Dauerangabe (runde_id null) – die nächste Runde greift darauf zurück,
  // sonst müsste der Schüler dasselbe zweimal eintragen.
  if (bookingMode === "fix") {
    const runde = await ladeOffeneRunde(admin);

    // Nur die Einträge desselben Geltungsbereichs ersetzen: läuft eine Runde,
    // deren Einträge – sonst die Dauerangabe. Alles zu löschen würde die
    // Antwort auf eine laufende Runde mitreissen.
    const loeschen = admin
      .from("student_verfuegbarkeit")
      .delete()
      .eq("student_id", user.id);
    await (runde ? loeschen.eq("runde_id", runde.id) : loeschen.is("runde_id", null));

    await admin.from("student_verfuegbarkeit").insert(
      verfuegbarkeiten.map((v) => ({
        student_id: user.id,
        runde_id: runde?.id ?? null,
        wochentag: v.wochentag,
        fruehestens: v.fruehestens,
        spaetestens: v.spaetestens,
        praeferenz: v.praeferenz,
      }))
    );

    if (runde) {
      await admin.from("planungs_antworten").upsert(
        {
          runde_id: runde.id,
          student_id: user.id,
          geantwortet_am: new Date().toISOString(),
        },
        { onConflict: "runde_id,student_id" }
      );
    }
  }

  const name = `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim();

  await sendEmailNow(admin, "abo_gestartet", {
    student_id: user.id,
    student_name: name || undefined,
    abo_label: ABO_LABELS[params.variante],
    rhythmus_text: rhythmus === "woechentlich" ? "jede Woche" : "alle zwei Wochen",
    // Beim Fixplatz steht der Termin noch aus – das wird offen benannt,
    // statt eine Zeit zu suggerieren, die es noch nicht gibt.
    fixplatz_text: null,
    termin_offen: bookingMode === "fix",
    lektionen: vorschau.lektionen,
    monatsbetrag: vorschau.monatsbetrag,
    laufzeit_monate: vorschau.laufzeitMonate,
    periode_start: periodeStart,
    periode_ende: vorschau.periodeEnde,
    termine: [],
    ferientage: vorschau.ferientage,
    auto_renew: params.autoRenew,
  });

  await sendEmailNow(admin, "abo_gestartet_admin", {
    student_id: user.id,
    student_name: name || undefined,
    abo_label: ABO_LABELS[params.variante],
    rhythmus_text: rhythmus === "woechentlich" ? "jede Woche" : "alle zwei Wochen",
    fixplatz_text: bookingMode === "fix" ? "Termin noch zuzuteilen" : "frei buchend",
    lektionen: vorschau.lektionen,
    monatsbetrag: vorschau.monatsbetrag,
    gesamtpreis: vorschau.gesamtpreis,
    periode_start: periodeStart,
    periode_ende: vorschau.periodeEnde,
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
