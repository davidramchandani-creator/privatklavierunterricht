"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_BUFFER_MIN,
  generateSeriesStarts,
  slotsFromStarts,
  validateSeries,
} from "@/lib/booking";
import { loadAvailabilityContext } from "@/lib/booking-server";
import { enqueueEmail } from "@/lib/emails-outbox";
import {
  type Package as Paket,
  PACKAGE_LABELS,
  PACKAGE_LESSONS,
  PACKAGE_VALIDITY_MONTHS,
  canBuyNewPackage,
  canCancelPackage,
  computeCancellationSettlement,
  computePackageState,
} from "@/lib/packages";
import { addMonths } from "@/lib/utils";
import { buildTwintLink } from "@/lib/twint";
import {
  syncAppointmentToCalendar,
  deleteCalendarEvent,
  testCalendarConnection,
  fullSyncFutureAppointments,
} from "@/lib/google-calendar";

/**
 * Bucht (ggf. als Serie) Termine für einen Schüler im neuen Schema.
 * Validiert transaktional gegen die Buchungs-Engine; 24h-Vorlauf wird als
 * Admin-Aktion übersprungen. Wird von Direktbuchung & Anfrage-Annahme genutzt.
 */
async function bookSeriesForStudent(
  admin: SupabaseClient,
  studentUserId: string,
  startIso: string,
  lessonsCount: number,
  intervalDays: number,
  source: "direct" | "public_request" | "admin_proposal" | "reschedule"
): Promise<{ appointmentIds: string[] } | { error: string }> {
  const { data: profile } = await admin
    .from("profiles")
    .select("buffer_time_minutes, email, vorname, nachname, adresse, payment_method")
    .eq("id", studentUserId)
    .single();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  const { data: pkgs } = await admin
    .from("packages")
    .select("*")
    .eq("student_id", studentUserId)
    .eq("status", "active");
  const pkg = (pkgs as Paket[] | null)?.find((p) => !canBuyNewPackage(p)) ?? null;
  if (!pkg) return { error: "Der Schüler hat kein aktives Paket." };

  const state = computePackageState(pkg);
  if (state.lessonsRemaining < lessonsCount) {
    return {
      error: `Das Paket hat nur noch ${state.lessonsRemaining} Lektion(en), benötigt werden ${lessonsCount}.`,
    };
  }

  const desiredStart = new Date(startIso);
  const now = new Date();
  const starts = generateSeriesStarts(desiredStart, lessonsCount, intervalDays);
  const seriesEnd = new Date(starts[starts.length - 1].getTime() + 3600000);

  const ctx = await loadAvailabilityContext(
    admin,
    studentUserId,
    bufferMin,
    desiredStart,
    seriesEnd,
    now,
    { skipLeadTime: true }
  );
  const validation = validateSeries(desiredStart, lessonsCount, intervalDays, ctx);
  if (!validation.ok) {
    return {
      error:
        "Mindestens ein Termin ist nicht verfügbar (Kollision/Abwesenheit/Zeitblock).",
    };
  }

  const seriesId = lessonsCount > 1 ? crypto.randomUUID() : null;
  const rows = slotsFromStarts(starts).map((s) => ({
    student_id: studentUserId,
    package_id: pkg.id,
    start_at: s.start.toISOString(),
    end_at: s.end.toISOString(),
    status: "booked",
    source,
    series_id: seriesId,
  }));

  const { data: created, error } = await admin
    .from("appointments")
    .insert(rows)
    .select("id");
  if (error || !created) return { error: "Termine konnten nicht erstellt werden." };

  // Für jeden Termin: Rechnung anlegen + Zahlungsmail planen
  for (const appt of rows) {
    const createdAppt = created[rows.indexOf(appt)];
    if (!createdAppt) continue;

    // Zahlungsart des Schülers hat Vorrang, dann Paket, dann QR als Default.
    const paymentMethod: "twint" | "qr" =
      ((profile?.payment_method as "twint" | "qr" | null) ??
        (pkg.payment_method as "twint" | "qr" | null)) ??
      "qr";
    const amount = Number(pkg.price_per_lesson ?? 0);
    const studentName = profile ? `${profile.vorname} ${profile.nachname}` : "Schüler";

    const { data: inv } = await admin
      .from("invoices")
      .insert({
        student_id: studentUserId,
        appointment_id: createdAppt.id,
        amount,
        payer_name: studentName,
        payer_address: profile?.adresse ?? null,
        status: "unpaid",
        method: paymentMethod,
        lesson_date: appt.start_at,
      })
      .select("id, invoice_number, access_token")
      .maybeSingle();

    if (inv && profile?.email) {
      const sendAt = new Date(appt.end_at);
      const basePayload = {
        to: profile.email,
        student_name: studentName,
        student_id: studentUserId,
        lesson_date: appt.start_at,
        amount,
        invoice_number: inv.invoice_number,
        invoice_id: inv.id,
      };
      if (paymentMethod === "qr") {
        await enqueueEmail(admin, "qr_invoice", basePayload, sendAt);
      } else {
        await enqueueEmail(admin, "twint_payment_request", {
          ...basePayload,
          twint_link: buildTwintLink(amount, inv.invoice_number ?? inv.id),
        }, sendAt);
      }
    }
  }

  // Google Calendar Sync (one-way, fehlertolerant)
  for (const c of created) {
    await syncAppointmentToCalendar(admin, c.id);
  }

  return { appointmentIds: created.map((c) => c.id) };
}

// ── Schüler ──────────────────────────────────────────────────────────────────

export async function inviteSchueler(formData: FormData) {
  const email = formData.get("email") as string;
  const vorname = formData.get("vorname") as string;
  const nachname = formData.get("nachname") as string;
  const telefon = (formData.get("telefon") as string) || null;
  const adresse = (formData.get("adresse") as string) || null;

  if (!email || !vorname || !nachname) {
    return { error: "E-Mail, Vorname und Nachname sind Pflichtfelder." };
  }

  const adminClient = await createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://privatklavierunterricht.vercel.app";

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { vorname, nachname },
      redirectTo: `${appUrl}/auth/callback?next=/auth/passwort-setzen`,
    });

  if (inviteError) {
    return { error: inviteError.message };
  }

  const userId = inviteData.user.id;

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    role: "student",
    vorname,
    nachname,
    email,
    telefon,
    adresse,
    aktiv: true,
  }, { onConflict: "id" });

  if (profileError) {
    return { error: "Profil konnte nicht erstellt werden: " + profileError.message };
  }

  revalidatePath("/admin/schueler");
  return { success: true };
}

export async function updateSchueler(id: string, formData: FormData) {
  const adminClient = await createAdminClient();

  const vorname = formData.get("vorname") as string;
  const nachname = formData.get("nachname") as string;
  const email = formData.get("email") as string;
  const telefon = (formData.get("telefon") as string) || null;
  const adresse = (formData.get("adresse") as string) || null;
  const notizen = (formData.get("notizen") as string) || null;

  const { error } = await adminClient
    .from("profiles")
    .update({ vorname, nachname, email, telefon, adresse, notizen })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/admin/schueler/${id}`);
  revalidatePath("/admin/schueler");
  return { success: true };
}

export async function deleteSchueler(id: string) {
  const adminClient = await createAdminClient();
  const { error } = await adminClient.from("profiles").update({ aktiv: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/schueler");
  revalidatePath(`/admin/schueler/${id}`);
  return { success: true };
}

export async function reactivateSchueler(id: string) {
  const adminClient = await createAdminClient();
  const { error } = await adminClient.from("profiles").update({ aktiv: true }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/schueler");
  revalidatePath(`/admin/schueler/${id}`);
  return { success: true };
}

export async function hardDeleteSchueler(id: string) {
  const adminClient = await createAdminClient();

  // Deleting the auth user cascades to profiles (and all linked data via FK)
  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) return { error: error.message };

  revalidatePath("/admin/schueler");
  return { success: true };
}

export async function resendInvite(email: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://privatklavierunterricht.vercel.app";
  const adminClient = await createAdminClient();

  // admin.generateLink bypasses PKCE – works across any browser/device
  const { error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${appUrl}/auth/callback?next=/auth/passwort-setzen`,
    },
  });

  if (error) return { error: error.message };
  return { success: true };
}


// ── Invoices / Zahlungen ──────────────────────────────────────────────────────

export async function updateInvoiceStatus(
  id: string,
  status: "paid" | "rejected" | "archived"
) {
  const adminClient = await createAdminClient();

  const update: Record<string, unknown> = { status };
  if (status === "paid") update.paid_at = new Date().toISOString();

  const { error } = await adminClient
    .from("invoices")
    .update(update)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/zahlungen");
  revalidatePath("/admin");
  return { success: true };
}


// ── Verfügbarkeit ─────────────────────────────────────────────────────────────

export type VerfuegbarkeitSlot = {
  wochentag: number;
  beginn_zeit: string;
  ende_zeit: string;
  aktiv: boolean;
};

export async function updateVerfuegbarkeit(slots: VerfuegbarkeitSlot[]) {
  const supabase = await createClient();

  // Delete all existing
  const { error: deleteError } = await supabase
    .from("admin_verfuegbarkeit")
    .delete()
    .gte("wochentag", 0);

  if (deleteError) return { error: deleteError.message };

  if (slots.length > 0) {
    const { error } = await supabase.from("admin_verfuegbarkeit").insert(slots);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/verfuegbarkeit");
  return { success: true };
}

// ── Preise ────────────────────────────────────────────────────────────────────

export async function updatePreise(formData: FormData) {
  const supabase = await createClient();

  const typen = ["einzellektion", "10er", "20er"] as const;

  for (const typ of typen) {
    const preis = parseFloat(formData.get(typ) as string);
    if (isNaN(preis)) continue;

    // Try to update existing, or insert
    const { data: existing } = await supabase
      .from("preise")
      .select("id")
      .eq("typ", typ)
      .single();

    if (existing) {
      await supabase
        .from("preise")
        .update({ preis_pro_lektion: preis, aktiv: true })
        .eq("id", existing.id);
    } else {
      await supabase.from("preise").insert({
        typ,
        preis_pro_lektion: preis,
        aktiv: true,
      });
    }
  }

  revalidatePath("/admin/preise");
  return { success: true };
}

// ── Terminanfragen (booking_requests) ───────────────────────────────────────

/**
 * Admin nimmt eine offene Terminanfrage an (Spec §4.1). Erstellt – bei Serien
 * transaktional (alle oder keiner) – die Termine im neuen Schema. Validiert
 * vorher mit der Buchungs-Engine (Kollisionen/Abwesenheiten/Zeitblöcke), die
 * 24h-Vorlaufregel wird als Admin-Aktion übersprungen.
 */
export async function acceptBookingRequest(requestId: string) {
  const admin = await createAdminClient();

  const { data: req } = await admin
    .from("booking_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (!req) return { error: "Anfrage nicht gefunden." };
  if (req.status !== "open") {
    return { error: "Diese Anfrage wurde bereits bearbeitet." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("vorname, nachname, email")
    .eq("id", req.student_id)
    .single();

  // Aktives, nutzbares Paket des Schülers (für freundliche Fehlermeldung)
  const { data: pkgs } = await admin
    .from("packages")
    .select("*")
    .eq("student_id", req.student_id)
    .eq("status", "active");
  const pkg = (pkgs as Paket[] | null)?.find((p) => !canBuyNewPackage(p)) ?? null;
  if (!pkg) return { error: "Der Schüler hat kein aktives Paket." };

  const state = computePackageState(pkg);
  if (state.lessonsRemaining < req.lessons_count) {
    return {
      error: `Das Paket hat nur noch ${state.lessonsRemaining} Lektion(en), benötigt werden ${req.lessons_count}.`,
    };
  }

  const starts = generateSeriesStarts(
    new Date(req.desired_start),
    req.lessons_count,
    req.interval_days
  );

  // Buchung über den gemeinsamen Pfad: erstellt Termine, Rechnungen,
  // geplante Zahlungsmails und synchronisiert den Google-Kalender.
  const result = await bookSeriesForStudent(
    admin,
    req.student_id,
    req.desired_start,
    req.lessons_count,
    req.interval_days,
    "public_request"
  );
  if ("error" in result) {
    return { error: result.error };
  }

  await admin
    .from("booking_requests")
    .update({
      status: "accepted",
      processed_at: new Date().toISOString(),
      created_appointment_ids: result.appointmentIds,
    })
    .eq("id", requestId);

  await enqueueEmail(admin, "booking_confirmed", {
    student_id: req.student_id,
    to: profile?.email,
    starts: starts.map((s) => s.toISOString()),
    lessons_count: req.lessons_count,
    interval_days: req.interval_days,
  });

  revalidatePath("/admin/terminanfragen");
  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  revalidatePath(`/admin/schueler/${req.student_id}`);
  return { success: true };
}

/** Admin lehnt eine Terminanfrage ab (optional mit Begründung). */
export async function rejectBookingRequest(requestId: string, reason?: string) {
  const admin = await createAdminClient();

  const { data: req } = await admin
    .from("booking_requests")
    .select("id, status, student_id")
    .eq("id", requestId)
    .single();

  if (!req) return { error: "Anfrage nicht gefunden." };
  if (req.status !== "open") {
    return { error: "Diese Anfrage wurde bereits bearbeitet." };
  }

  const { error } = await admin
    .from("booking_requests")
    .update({ status: "rejected", processed_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return { error: "Anfrage konnte nicht abgelehnt werden." };

  await enqueueEmail(admin, "booking_rejected", {
    student_id: req.student_id,
    request_id: requestId,
    reason: reason ?? null,
  });

  revalidatePath("/admin/terminanfragen");
  return { success: true };
}

/**
 * Admin nimmt eine Verschiebungsanfrage an (Meilenstein 6). Validiert den
 * Wunschslot erneut gegen die Engine (24h-Vorlauf übersprungen, eigener Termin
 * ausgenommen) und verschiebt den Termin auf den neuen Zeitpunkt.
 */
export async function acceptReschedule(rescheduleId: string) {
  const admin = await createAdminClient();

  const { data: rr } = await admin
    .from("reschedule_requests")
    .select("*")
    .eq("id", rescheduleId)
    .single();

  if (!rr) return { error: "Verschiebung nicht gefunden." };
  if (rr.status !== "open") {
    return { error: "Diese Anfrage wurde bereits bearbeitet." };
  }

  const { data: appt } = await admin
    .from("appointments")
    .select("id, status, start_at")
    .eq("id", rr.appointment_id)
    .single();
  if (!appt) return { error: "Zugehöriger Termin nicht gefunden." };
  if (appt.status !== "booked") {
    return { error: "Der Termin ist nicht mehr verschiebbar." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("buffer_time_minutes, email")
    .eq("id", rr.student_id)
    .single();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  const newStart = new Date(rr.proposed_start);
  const now = new Date();
  const slotEnd = new Date(newStart.getTime() + 3600000);
  const ctx = await loadAvailabilityContext(
    admin,
    rr.student_id,
    bufferMin,
    newStart,
    slotEnd,
    now,
    { skipLeadTime: true, excludeAppointmentId: rr.appointment_id }
  );
  const validation = validateSeries(newStart, 1, 7, ctx);
  if (!validation.ok) {
    return {
      error:
        "Der gewünschte neue Zeitpunkt ist nicht mehr verfügbar (Kollision/Abwesenheit).",
    };
  }

  const newEnd = slotsFromStarts([newStart])[0].end;
  const { error: updateError } = await admin
    .from("appointments")
    .update({
      start_at: newStart.toISOString(),
      end_at: newEnd.toISOString(),
    })
    .eq("id", rr.appointment_id);
  if (updateError) {
    return { error: "Termin konnte nicht verschoben werden." };
  }

  // Google Calendar: verschobenen Termin aktualisieren
  await syncAppointmentToCalendar(admin, rr.appointment_id);

  await admin
    .from("reschedule_requests")
    .update({ status: "accepted", aktualisiert_am: new Date().toISOString() })
    .eq("id", rescheduleId);

  await enqueueEmail(admin, "reschedule_confirmed", {
    student_id: rr.student_id,
    to: profile?.email,
    original_start: rr.original_start,
    proposed_start: rr.proposed_start,
  });

  revalidatePath("/admin/terminanfragen");
  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  revalidatePath(`/admin/schueler/${rr.student_id}`);
  return { success: true };
}

/** Admin lehnt eine Verschiebungsanfrage ab (optional mit Begründung). */
export async function rejectReschedule(rescheduleId: string, reason?: string) {
  const admin = await createAdminClient();

  const { data: rr } = await admin
    .from("reschedule_requests")
    .select("id, status, student_id, original_start, proposed_start")
    .eq("id", rescheduleId)
    .single();

  if (!rr) return { error: "Verschiebung nicht gefunden." };
  if (rr.status !== "open") {
    return { error: "Diese Anfrage wurde bereits bearbeitet." };
  }

  const { error } = await admin
    .from("reschedule_requests")
    .update({ status: "rejected", aktualisiert_am: new Date().toISOString() })
    .eq("id", rescheduleId);
  if (error) return { error: "Anfrage konnte nicht abgelehnt werden." };

  await enqueueEmail(admin, "reschedule_rejected", {
    student_id: rr.student_id,
    original_start: rr.original_start,
    proposed_start: rr.proposed_start,
    reason: reason ?? null,
  });

  revalidatePath("/admin/terminanfragen");
  return { success: true };
}

// ── Admin: Preise, Pakete, Direktbuchung, Termine (neues Schema) ─────────────

/** Setzt die Preise & Pufferzeit eines Schülers (profiles). Spec §11.2. */
export async function updateStudentPrices(
  userId: string,
  schuelerId: string,
  formData: FormData
) {
  const admin = await createAdminClient();

  const update: Record<string, number | string> = {};
  const fields = ["price_single", "price_10er", "price_20er", "travel_surcharge"] as const;
  for (const f of fields) {
    const v = parseFloat(formData.get(f) as string);
    if (!isNaN(v) && v >= 0) update[f] = v;
  }
  const buffer = parseInt(formData.get("buffer_time_minutes") as string);
  if (buffer === 15 || buffer === 30) update.buffer_time_minutes = buffer;

  // Zahlungsart pro Schüler (TWINT oder QR-Rechnung)
  const pm = formData.get("payment_method") as string | null;
  if (pm === "twint" || pm === "qr") update.payment_method = pm;

  if (Object.keys(update).length === 0) return { success: true };

  const { error } = await admin.from("profiles").update(update).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/schueler/${schuelerId}`);
  return { success: true };
}

/** Admin legt einem Schüler ein Paket an (neues Schema). */
export async function createPackageAdmin(formData: FormData) {
  const admin = await createAdminClient();

  const userId = formData.get("student_user_id") as string;
  const schuelerId = formData.get("schueler_id") as string;
  const type = formData.get("type") as string; // single|10er|20er
  let paymentMethod = (formData.get("payment_method") as string) || null;
  const pricePerLesson = parseFloat(formData.get("price_per_lesson") as string);

  if (!userId || !["single", "10er", "20er"].includes(type)) {
    return { error: "Ungültige Paketdaten." };
  }
  if (isNaN(pricePerLesson) || pricePerLesson < 0) {
    return { error: "Ungültiger Preis." };
  }

  // Ohne explizite Auswahl die Zahlungsart des Schülers übernehmen.
  if (paymentMethod !== "twint" && paymentMethod !== "qr") {
    const { data: prof } = await admin
      .from("profiles")
      .select("payment_method")
      .eq("id", userId)
      .maybeSingle();
    paymentMethod = (prof?.payment_method as string) ?? "qr";
  }

  const lessonsTotal = PACKAGE_LESSONS[type];
  const validityMonths = PACKAGE_VALIDITY_MONTHS[type];
  const startsAt = new Date();
  const expiresAt = validityMonths != null ? addMonths(startsAt, validityMonths) : null;

  const { error } = await admin.from("packages").insert({
    student_id: userId,
    type,
    lessons_total: lessonsTotal,
    lessons_used: 0,
    name: PACKAGE_LABELS[type],
    price_per_lesson: pricePerLesson,
    total_price: pricePerLesson * lessonsTotal,
    payment_method: paymentMethod,
    starts_at: startsAt.toISOString(),
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    status: "active",
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/schueler/${schuelerId}`);
  return { success: true };
}

/** Admin bucht direkt (ohne Anfrage) – sofort bestätigt. Spec §4.3. */
export async function createDirectBooking(formData: FormData) {
  const admin = await createAdminClient();

  const userId = formData.get("student_user_id") as string;
  const schuelerId = formData.get("schueler_id") as string;
  const startIso = formData.get("start") as string;
  const lessonsCount = parseInt(formData.get("lessons_count") as string) || 1;
  const intervalDays = parseInt(formData.get("interval_days") as string) || 7;

  if (!userId || !startIso) return { error: "Schüler und Startzeit erforderlich." };

  const result = await bookSeriesForStudent(
    admin,
    userId,
    new Date(startIso).toISOString(),
    lessonsCount,
    intervalDays,
    "direct"
  );
  if ("error" in result) return result;

  revalidatePath(`/admin/schueler/${schuelerId}`);
  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  return { success: true };
}

/** Termin als abgeschlossen markieren (neues Schema). */
export async function completeAppointmentNew(id: string, schuelerId: string) {
  const admin = await createAdminClient();
  const { error } = await admin
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", id);
  if (error) return { error: error.message };

  // Google Calendar: Event-Farbe auf „abgeschlossen" aktualisieren
  await syncAppointmentToCalendar(admin, id);

  revalidatePath(`/admin/schueler/${schuelerId}`);
  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  return { success: true };
}

/** Termin stornieren (neues Schema). Gibt die Lektion wieder frei. */
export async function cancelAppointmentNew(id: string, schuelerId: string) {
  const admin = await createAdminClient();

  // Termin laden (für Schüler-Benachrichtigung).
  const { data: appt } = await admin
    .from("appointments")
    .select("start_at, student_id, status")
    .eq("id", id)
    .maybeSingle();

  const { error } = await admin
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) return { error: error.message };

  // Google Calendar: Event löschen
  await deleteCalendarEvent(admin, id);

  // Offene Rechnung zu diesem Termin stornieren (Spec §6)
  await admin
    .from("invoices")
    .update({ status: "cancelled" })
    .eq("appointment_id", id)
    .in("status", ["unpaid", "pending_confirmation", "rejected"]);

  // Schüler über die Absage informieren (Spec §9).
  if (appt?.student_id && appt.status !== "cancelled") {
    await enqueueEmail(admin, "appointment_cancelled_by_admin", {
      student_id: appt.student_id,
      appointment_id: id,
      start_at: appt.start_at,
    });
  }

  revalidatePath(`/admin/schueler/${schuelerId}`);
  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  return { success: true };
}

// ── Abwesenheiten, Zeitblöcke & Timer (Meilenstein 8) ───────────────────────

/** Inklusive Tage zwischen zwei Datums-Strings (YYYY-MM-DD). */
function inclusiveDays(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const s = Date.UTC(sy, sm - 1, sd);
  const e = Date.UTC(ey, em - 1, ed);
  return Math.round((e - s) / 86400000) + 1;
}

/**
 * Verlängert die Laufzeit eines Pakets um `days` Tage. Bei pausiertem Paket
 * wird die eingefrorene Restzeit erhöht, sonst `expires_at`. Loggt optional
 * in package_extensions (für spätere Rücknahme bei gelöschter Abwesenheit).
 */
async function applyExtensionToPackage(
  admin: SupabaseClient,
  pkg: {
    id: string;
    student_id: string;
    expires_at: string | null;
    paused: boolean;
    pause_remaining_seconds: number | null;
  },
  days: number,
  absenceId: string | null,
  reason: string
) {
  if (days <= 0) return;
  const addSeconds = days * 86400;

  if (pkg.paused) {
    const next = (pkg.pause_remaining_seconds ?? 0) + addSeconds;
    await admin
      .from("packages")
      .update({ pause_remaining_seconds: next })
      .eq("id", pkg.id);
  } else if (pkg.expires_at) {
    const next = new Date(
      new Date(pkg.expires_at).getTime() + addSeconds * 1000
    ).toISOString();
    await admin.from("packages").update({ expires_at: next }).eq("id", pkg.id);
  } else {
    return; // Pakete ohne Ablauf (Einzellektion) werden nicht verlängert
  }

  await admin.from("package_extensions").insert({
    student_id: pkg.student_id,
    package_id: pkg.id,
    absence_id: absenceId,
    days_added: days,
    reason,
  });
}

type ExtendablePackage = {
  id: string;
  student_id: string;
  expires_at: string | null;
  paused: boolean;
  pause_remaining_seconds: number | null;
};

/** Admin/Schüler-Abwesenheit anlegen (Spec §7). */
export async function createAbsence(formData: FormData) {
  const admin = await createAdminClient();

  const scope = formData.get("scope") as string; // admin | student
  const studentUserId = (formData.get("student_user_id") as string) || null;
  const title = (formData.get("title") as string) || "";
  const startDate = formData.get("start_date") as string;
  const endDate = formData.get("end_date") as string;
  const autoExtend = formData.get("auto_extend") !== "false";

  if (!startDate || !endDate) return { error: "Start- und Enddatum erforderlich." };
  if (scope === "student" && !studentUserId) {
    return { error: "Für eine Schüler-Abwesenheit ist ein Schüler nötig." };
  }
  if (endDate < startDate) return { error: "Enddatum liegt vor dem Startdatum." };

  const { data: absence, error } = await admin
    .from("absences")
    .insert({
      scope,
      student_id: scope === "student" ? studentUserId : null,
      title,
      start_date: startDate,
      end_date: endDate,
      auto_extend: autoExtend,
    })
    .select("id")
    .single();

  if (error || !absence) return { error: "Abwesenheit konnte nicht erstellt werden." };

  if (autoExtend) {
    const days = inclusiveDays(startDate, endDate);
    let query = admin
      .from("packages")
      .select("id, student_id, expires_at, paused, pause_remaining_seconds")
      .eq("status", "active");
    if (scope === "student") query = query.eq("student_id", studentUserId);

    const { data: pkgs } = await query;
    for (const pkg of (pkgs as ExtendablePackage[] | null) ?? []) {
      await applyExtensionToPackage(
        admin,
        pkg,
        days,
        absence.id,
        `Abwesenheit: ${title || (scope === "admin" ? "Admin" : "Schüler")}`
      );
    }
  }

  revalidatePath("/admin/abwesenheiten");
  if (scope === "student" && studentUserId) {
    revalidatePath("/admin/schueler");
  }
  return { success: true };
}

/** Abwesenheit löschen und die Timer-Verlängerung zurückrechnen. */
export async function deleteAbsence(id: string) {
  const admin = await createAdminClient();

  // Verlängerungen dieser Abwesenheit zurücknehmen
  const { data: logs } = await admin
    .from("package_extensions")
    .select("id, package_id, days_added")
    .eq("absence_id", id);

  for (const log of logs ?? []) {
    const { data: pkg } = await admin
      .from("packages")
      .select("id, expires_at, paused, pause_remaining_seconds")
      .eq("id", log.package_id)
      .single();
    if (!pkg) continue;

    const subSeconds = log.days_added * 86400;
    if (pkg.paused) {
      const next = Math.max(0, (pkg.pause_remaining_seconds ?? 0) - subSeconds);
      await admin
        .from("packages")
        .update({ pause_remaining_seconds: next })
        .eq("id", pkg.id);
    } else if (pkg.expires_at) {
      const next = new Date(
        new Date(pkg.expires_at).getTime() - subSeconds * 1000
      ).toISOString();
      await admin.from("packages").update({ expires_at: next }).eq("id", pkg.id);
    }
    await admin.from("package_extensions").delete().eq("id", log.id);
  }

  const { error } = await admin.from("absences").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/abwesenheiten");
  return { success: true };
}

/** Einmaligen Zeitblock anlegen. */
export async function createTimeBlock(formData: FormData) {
  const admin = await createAdminClient();
  const title = (formData.get("title") as string) || "";
  const date = formData.get("date") as string;
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;

  if (!date || !startTime || !endTime) return { error: "Alle Felder erforderlich." };
  if (endTime <= startTime) return { error: "Endzeit muss nach Startzeit liegen." };

  const { error } = await admin
    .from("time_blocks")
    .insert({ title, date, start_time: startTime, end_time: endTime });
  if (error) return { error: error.message };

  revalidatePath("/admin/abwesenheiten");
  return { success: true };
}

export async function deleteTimeBlock(id: string) {
  const admin = await createAdminClient();
  const { error } = await admin.from("time_blocks").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/abwesenheiten");
  return { success: true };
}

/** Wiederkehrende Sperrregel anlegen (alle 7/14 Tage). */
export async function createTimeBlockRule(formData: FormData) {
  const admin = await createAdminClient();
  const title = (formData.get("title") as string) || "";
  const startDate = formData.get("start_date") as string;
  const startTime = formData.get("start_time") as string;
  const endTime = formData.get("end_time") as string;
  const intervalDays = parseInt(formData.get("interval_days") as string) || 7;

  if (!startDate || !startTime || !endTime) return { error: "Alle Felder erforderlich." };
  if (endTime <= startTime) return { error: "Endzeit muss nach Startzeit liegen." };
  if (intervalDays !== 7 && intervalDays !== 14) return { error: "Intervall muss 7 oder 14 Tage sein." };

  const { error } = await admin.from("time_block_rules").insert({
    title,
    start_date: startDate,
    start_time: startTime,
    end_time: endTime,
    interval_days: intervalDays,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/abwesenheiten");
  return { success: true };
}

export async function deleteTimeBlockRule(id: string) {
  const admin = await createAdminClient();
  const { error } = await admin.from("time_block_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/abwesenheiten");
  return { success: true };
}

/** Paket-Timer pausieren: Restzeit einfrieren. Spec §7. */
export async function pausePackage(packageId: string, schuelerId: string) {
  const admin = await createAdminClient();
  const { data: pkg } = await admin
    .from("packages")
    .select("id, expires_at, paused")
    .eq("id", packageId)
    .single();
  if (!pkg) return { error: "Paket nicht gefunden." };
  if (pkg.paused) return { success: true };

  const remaining = pkg.expires_at
    ? Math.max(0, Math.floor((new Date(pkg.expires_at).getTime() - Date.now()) / 1000))
    : null;

  const { error } = await admin
    .from("packages")
    .update({
      paused: true,
      pause_remaining_seconds: remaining,
      paused_at: new Date().toISOString(),
    })
    .eq("id", packageId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/schueler/${schuelerId}`);
  return { success: true };
}

/** Paket-Timer fortsetzen: Ablauf = jetzt + eingefrorene Restzeit. Spec §7. */
export async function resumePackage(packageId: string, schuelerId: string) {
  const admin = await createAdminClient();
  const { data: pkg } = await admin
    .from("packages")
    .select("id, paused, pause_remaining_seconds")
    .eq("id", packageId)
    .single();
  if (!pkg) return { error: "Paket nicht gefunden." };
  if (!pkg.paused) return { success: true };

  const update: Record<string, unknown> = {
    paused: false,
    pause_remaining_seconds: null,
    paused_at: null,
  };
  if (pkg.pause_remaining_seconds != null) {
    update.expires_at = new Date(
      Date.now() + pkg.pause_remaining_seconds * 1000
    ).toISOString();
  }

  const { error } = await admin.from("packages").update(update).eq("id", packageId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/schueler/${schuelerId}`);
  return { success: true };
}

/** Paket-Timer manuell um N Tage verlängern. */
export async function extendPackage(
  packageId: string,
  schuelerId: string,
  days: number,
  reason?: string
) {
  if (!days || days <= 0) return { error: "Ungültige Anzahl Tage." };
  const admin = await createAdminClient();
  const { data: pkg } = await admin
    .from("packages")
    .select("id, student_id, expires_at, paused, pause_remaining_seconds")
    .eq("id", packageId)
    .single();
  if (!pkg) return { error: "Paket nicht gefunden." };

  await applyExtensionToPackage(
    admin,
    pkg as ExtendablePackage,
    days,
    null,
    reason || "Manuelle Verlängerung"
  );

  revalidatePath(`/admin/schueler/${schuelerId}`);
  return { success: true };
}

/**
 * Storniert ein Paket mit Einzelpreis-Nachberechnung (Spec §10, Meilenstein 10).
 * Erlaubt nur bis einschliesslich der 3. genutzten Lektion. Die genutzten
 * Lektionen werden anhand der tatsächlich gebuchten/abgeschlossenen Termine
 * gezählt; künftige gebuchte Termine dieses Pakets werden storniert. Gibt die
 * berechnete Abrechnung (Rückerstattung/Nachzahlung) zurück.
 */
export async function cancelPackage(packageId: string, schuelerId: string) {
  const admin = await createAdminClient();

  const { data: pkg } = await admin
    .from("packages")
    .select("*")
    .eq("id", packageId)
    .single();
  if (!pkg) return { error: "Paket nicht gefunden." };

  // Genutzte Lektionen aus tatsächlichen Terminen zählen (Spec §3).
  const { count: usedCount } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("package_id", packageId)
    .in("status", ["booked", "completed"]);
  const lessonsUsed = usedCount ?? 0;

  if (!canCancelPackage(pkg as Paket, lessonsUsed)) {
    return {
      error:
        "Dieses Paket kann nicht mehr storniert werden (nur bis zur 3. genutzten Lektion bei aktiven/pausierten Paketen).",
    };
  }

  const settlement = computeCancellationSettlement(pkg as Paket, lessonsUsed);

  // Künftige gebuchte Termine dieses Pakets stornieren.
  const { data: futureAppts } = await admin
    .from("appointments")
    .select("id")
    .eq("package_id", packageId)
    .eq("status", "booked")
    .gte("start_at", new Date().toISOString());
  if (futureAppts && futureAppts.length > 0) {
    const ids = futureAppts.map((a) => a.id);
    await admin.from("appointments").update({ status: "cancelled" }).in("id", ids);
    // Google-Events der stornierten Termine löschen
    for (const fid of ids) {
      await deleteCalendarEvent(admin, fid);
    }
    // Zugehörige offene Rechnungen stornieren
    await admin
      .from("invoices")
      .update({ status: "cancelled" })
      .in("appointment_id", ids)
      .in("status", ["unpaid", "pending_confirmation", "rejected"]);
  }

  const { error } = await admin
    .from("packages")
    .update({
      status: "cancelled",
      paused: false,
      pause_remaining_seconds: null,
      paused_at: null,
      aktualisiert_am: new Date().toISOString(),
    })
    .eq("id", packageId);
  if (error) return { error: "Paket konnte nicht storniert werden." };

  // Schüler benachrichtigen (Outbox).
  const { data: profile } = await admin
    .from("profiles")
    .select("email, vorname, nachname, adresse, payment_method")
    .eq("id", pkg.student_id)
    .maybeSingle();
  await enqueueEmail(admin, "package_cancelled", {
    student_id: pkg.student_id,
    to: profile?.email,
    lessons_used: settlement.lessonsUsed,
    single_lesson_price: settlement.singleLessonPrice,
    refund: settlement.refund,
    owed: settlement.owed,
  });

  // Nachzahlung: zahlbare Storno-Rechnung anlegen, damit der Schüler sie über
  // das normale Zahlungssystem (TWINT/QR) begleichen kann (sofort fällig).
  if (settlement.owed > 0) {
    const paymentMethod: "twint" | "qr" =
      ((profile?.payment_method as "twint" | "qr" | null) ??
        (pkg.payment_method as "twint" | "qr" | null)) ??
      "qr";
    const studentName = profile
      ? `${profile.vorname} ${profile.nachname}`
      : "Schüler";
    const { data: inv } = await admin
      .from("invoices")
      .insert({
        student_id: pkg.student_id,
        appointment_id: null,
        amount: settlement.owed,
        payer_name: studentName,
        payer_address: profile?.adresse ?? null,
        status: "unpaid",
        method: paymentMethod,
        lesson_date: null,
      })
      .select("id, invoice_number")
      .maybeSingle();

    if (inv && profile?.email) {
      const basePayload = {
        to: profile.email,
        student_name: studentName,
        student_id: pkg.student_id,
        amount: settlement.owed,
        invoice_number: inv.invoice_number,
        invoice_id: inv.id,
      };
      if (paymentMethod === "qr") {
        await enqueueEmail(admin, "qr_invoice", basePayload);
      } else {
        await enqueueEmail(admin, "twint_payment_request", {
          ...basePayload,
          twint_link: buildTwintLink(settlement.owed, inv.invoice_number ?? inv.id),
        });
      }
    }
  }

  revalidatePath(`/admin/schueler/${schuelerId}`);
  revalidatePath("/admin");
  return { success: true, settlement };
}

// ── Rechnungen / Zahlungen (Meilenstein 9) ────────────────────────────────────

/**
 * Erstellt eine Rechnung für einen Termin (neues Schema). Wird intern beim
 * Buchen aufgerufen; kann auch manuell ausgelöst werden.
 */
export async function createInvoiceForAppointment(appointmentId: string) {
  const admin = await createAdminClient();

  const { data: appt } = await admin
    .from("appointments")
    .select("id, student_id, start_at, end_at, package_id")
    .eq("id", appointmentId)
    .single();
  if (!appt) return { error: "Termin nicht gefunden." };

  const { data: profile } = await admin
    .from("profiles")
    .select("vorname, nachname, email, adresse")
    .eq("id", appt.student_id)
    .maybeSingle();

  const { data: pkg } = await admin
    .from("packages")
    .select("price_per_lesson, payment_method")
    .eq("id", appt.package_id ?? "")
    .maybeSingle();

  const amount = Number(pkg?.price_per_lesson ?? 85);
  const paymentMethod = pkg?.payment_method ?? "twint";
  const invoiceNumber =
    "PIANO-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000);

  const { data: inv, error } = await admin
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      student_id: appt.student_id,
      appointment_id: appointmentId,
      amount,
      payer_name: profile ? `${profile.vorname} ${profile.nachname}` : null,
      payer_address: profile?.adresse ?? null,
      status: "unpaid",
      method: paymentMethod,
      lesson_date: appt.start_at,
    })
    .select("id")
    .single();

  if (error || !inv) return { error: "Rechnung konnte nicht erstellt werden." };

  revalidatePath("/admin/zahlungen");
  return { success: true, invoiceId: inv.id };
}

/** Admin bestätigt eine Zahlung (pending_confirmation → paid). */
export async function confirmInvoicePayment(invoiceId: string) {
  const admin = await createAdminClient();

  const { data: inv } = await admin
    .from("invoices")
    .select("id, student_id, invoice_number, amount, lesson_date")
    .eq("id", invoiceId)
    .single();
  if (!inv) return { error: "Rechnung nicht gefunden." };

  const { error } = await admin
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) return { error: error.message };

  const { data: profile } = await admin
    .from("profiles")
    .select("email, vorname, nachname")
    .eq("id", inv.student_id)
    .maybeSingle();

  if (profile?.email) {
    await enqueueEmail(admin, "payment_confirmed", {
      to: profile.email,
      student_name: `${profile.vorname} ${profile.nachname}`,
      student_id: inv.student_id,
      lesson_date: inv.lesson_date,
      amount: inv.amount,
      invoice_number: inv.invoice_number,
    });
  }

  revalidatePath("/admin/zahlungen");
  return { success: true };
}

/** Admin lehnt eine Zahlung ab (pending_confirmation → rejected). */
export async function rejectInvoicePayment(invoiceId: string, reason?: string) {
  const admin = await createAdminClient();

  const { data: inv } = await admin
    .from("invoices")
    .select("id, student_id, invoice_number, amount, lesson_date")
    .eq("id", invoiceId)
    .single();
  if (!inv) return { error: "Rechnung nicht gefunden." };

  const { error } = await admin
    .from("invoices")
    .update({ status: "rejected" })
    .eq("id", invoiceId);
  if (error) return { error: error.message };

  const { data: profile } = await admin
    .from("profiles")
    .select("email, vorname, nachname")
    .eq("id", inv.student_id)
    .maybeSingle();

  if (profile?.email) {
    await enqueueEmail(admin, "payment_rejected", {
      to: profile.email,
      student_name: `${profile.vorname} ${profile.nachname}`,
      student_id: inv.student_id,
      lesson_date: inv.lesson_date,
      amount: inv.amount,
      invoice_number: inv.invoice_number,
      reason: reason ?? null,
    });
  }

  revalidatePath("/admin/zahlungen");
  return { success: true };
}

/** Admin archiviert eine Rechnung (aus der aktiven Liste entfernen). */
export async function archiveInvoice(invoiceId: string) {
  const admin = await createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({ status: "archived" })
    .eq("id", invoiceId);
  if (error) return { error: error.message };
  revalidatePath("/admin/zahlungen");
  return { success: true };
}

/** Admin sendet die Zahlungsmail für eine Rechnung erneut (sofort). */
export async function resendPaymentEmail(invoiceId: string) {
  const admin = await createAdminClient();

  const { data: inv } = await admin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();
  if (!inv) return { error: "Rechnung nicht gefunden." };

  const { data: profile } = await admin
    .from("profiles")
    .select("email, vorname, nachname")
    .eq("id", inv.student_id)
    .maybeSingle();
  if (!profile?.email) return { error: "Schüler-E-Mail nicht gefunden." };

  const studentName = `${profile.vorname} ${profile.nachname}`;

  if (inv.method === "qr") {
    await enqueueEmail(admin, "qr_invoice", {
      to: profile.email,
      student_name: studentName,
      student_id: inv.student_id,
      lesson_date: inv.lesson_date,
      amount: inv.amount,
      invoice_number: inv.invoice_number,
      invoice_id: invoiceId,
    });
  } else {
    const twintLink = buildTwintLink(Number(inv.amount ?? 0), inv.invoice_number ?? invoiceId);
    await enqueueEmail(admin, "twint_payment_request", {
      to: profile.email,
      student_name: studentName,
      student_id: inv.student_id,
      lesson_date: inv.lesson_date,
      amount: inv.amount,
      twint_link: twintLink,
      invoice_number: inv.invoice_number,
      invoice_id: invoiceId,
    });
  }

  revalidatePath("/admin/zahlungen");
  return { success: true };
}

// ── Google Calendar (Meilenstein 12) ─────────────────────────────────────────

/** Testet die Verbindung zum Google-Kalender (Einstellungsseite). */
export async function testGoogleCalendar() {
  return await testCalendarConnection();
}

/** Synchronisiert alle zukünftigen gebuchten Termine in den Google-Kalender. */
export async function runFullCalendarSync() {
  const admin = await createAdminClient();
  const result = await fullSyncFutureAppointments(admin);
  revalidatePath("/admin/einstellungen");
  return { success: true, ...result };
}

// ── Anfragen ─────────────────────────────────────────────────────────────────

export async function updateAnfrageStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("anfragen")
    .update({ status })
    .eq("id", id);
  if (error) return { error: "Status konnte nicht aktualisiert werden." };
  revalidatePath("/admin/anfragen");
  return { success: true };
}
