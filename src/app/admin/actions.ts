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
  computePackageState,
} from "@/lib/packages";
import { addMonths } from "@/lib/utils";

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
    .select("buffer_time_minutes")
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

  // Invite user via Auth – redirectTo sends user to password-set page after clicking link
  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { vorname, nachname },
      redirectTo: `${appUrl}/auth/callback?next=/auth/passwort-setzen`,
    });

  if (inviteError) {
    return { error: inviteError.message };
  }

  const userId = inviteData.user.id;

  // Set role
  const { error: roleError } = await adminClient.from("profile_roles").insert({
    user_id: userId,
    role: "schueler",
  });
  if (roleError) {
    return { error: "Rolle konnte nicht gesetzt werden: " + roleError.message };
  }

  // Create schueler record
  const { error: schuelerError } = await adminClient.from("schueler").insert({
    user_id: userId,
    vorname,
    nachname,
    email,
    telefon,
    adresse,
    aktiv: true,
  });

  if (schuelerError) {
    return { error: "Schüler-Datensatz konnte nicht erstellt werden: " + schuelerError.message };
  }

  // Create/upsert profiles row for the new student
  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    role: "student",
    vorname,
    nachname,
    email,
    // price fields default to spec values (85/70/65/0)
  }, { onConflict: "id" });

  if (profileError) {
    // Non-fatal: log but don't block invite success
    console.error("Profile upsert failed:", profileError.message);
  }

  revalidatePath("/admin/schueler");
  return { success: true };
}

export async function updateSchueler(id: string, formData: FormData) {
  const supabase = await createClient();

  const vorname = formData.get("vorname") as string;
  const nachname = formData.get("nachname") as string;
  const email = formData.get("email") as string;
  const telefon = (formData.get("telefon") as string) || null;
  const adresse = (formData.get("adresse") as string) || null;
  const notizen = (formData.get("notizen") as string) || null;

  const { error } = await supabase
    .from("schueler")
    .update({ vorname, nachname, email, telefon, adresse, notizen })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/admin/schueler/${id}`);
  revalidatePath("/admin/schueler");
  return { success: true };
}

export async function deleteSchueler(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("schueler").update({ aktiv: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/schueler");
  revalidatePath(`/admin/schueler/${id}`);
  return { success: true };
}

export async function reactivateSchueler(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("schueler").update({ aktiv: true }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/schueler");
  revalidatePath(`/admin/schueler/${id}`);
  return { success: true };
}

export async function hardDeleteSchueler(id: string) {
  const adminClient = await createAdminClient();

  // Get user_id before deleting
  const { data: schueler } = await adminClient
    .from("schueler")
    .select("user_id")
    .eq("id", id)
    .single();

  // Delete schueler record (cascades to pakete, termine, zahlungen, bewertungen)
  const { error: schuelerError } = await adminClient
    .from("schueler")
    .delete()
    .eq("id", id);

  if (schuelerError) return { error: schuelerError.message };

  // Delete auth user if linked
  if (schueler?.user_id) {
    await adminClient.auth.admin.deleteUser(schueler.user_id);
  }

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

// ── Pakete ────────────────────────────────────────────────────────────────────

export async function createPaket(formData: FormData) {
  const supabase = await createClient();

  const schueler_id = formData.get("schueler_id") as string;
  const typ = formData.get("typ") as string;
  const lektionen_gesamt = parseInt(formData.get("lektionen_gesamt") as string);
  const preis_pro_lektion = parseFloat(formData.get("preis_pro_lektion") as string);
  const gueltig_bis = (formData.get("gueltig_bis") as string) || null;

  const { error } = await supabase.from("pakete").insert({
    schueler_id,
    typ,
    lektionen_gesamt,
    lektionen_genutzt: 0,
    preis_pro_lektion,
    aktiv: true,
    gueltig_bis: gueltig_bis ? new Date(gueltig_bis).toISOString() : null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/admin/schueler/${schueler_id}`);
  return { success: true };
}

export async function updatePaketStatus(id: string, aktiv: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("pakete")
    .update({ aktiv })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/schueler");
  return { success: true };
}

// ── Termine ───────────────────────────────────────────────────────────────────

export async function createTermin(formData: FormData) {
  const supabase = await createClient();

  const schueler_id = formData.get("schueler_id") as string;
  const paket_id = (formData.get("paket_id") as string) || null;
  const beginn = new Date(formData.get("beginn") as string).toISOString();
  const ende = new Date(formData.get("ende") as string).toISOString();
  const notiz = (formData.get("notiz") as string) || null;

  const { error } = await supabase.from("termine").insert({
    schueler_id,
    paket_id,
    beginn,
    ende,
    status: "bestaetigt",
    notiz,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/kalender");
  revalidatePath(`/admin/schueler/${schueler_id}`);
  return { success: true };
}

export async function storniereTerminAdmin(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("termine")
    .update({ status: "storniert" })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  return { success: true };
}

export async function abschliessenTermin(id: string) {
  const supabase = await createClient();

  const { data: termin, error: fetchError } = await supabase
    .from("termine")
    .select("paket_id")
    .eq("id", id)
    .single();

  if (fetchError || !termin) return { error: "Termin nicht gefunden." };

  const { error } = await supabase
    .from("termine")
    .update({ status: "abgeschlossen" })
    .eq("id", id);

  if (error) return { error: error.message };

  if (termin.paket_id) {
    const { data: paket } = await supabase
      .from("pakete")
      .select("lektionen_genutzt")
      .eq("id", termin.paket_id)
      .single();

    if (paket) {
      await supabase
        .from("pakete")
        .update({ lektionen_genutzt: paket.lektionen_genutzt + 1 })
        .eq("id", termin.paket_id);
    }
  }

  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  return { success: true };
}

// ── Zahlungen ─────────────────────────────────────────────────────────────────

export async function updateZahlungStatus(
  id: string,
  status: string,
  bezahlt_am?: string
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("zahlungen")
    .update({
      status,
      bezahlt_am: bezahlt_am ?? (status === "bezahlt" ? new Date().toISOString().split("T")[0] : null),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/zahlungen");
  revalidatePath("/admin");
  return { success: true };
}

export async function createZahlung(formData: FormData) {
  const supabase = await createClient();

  const schueler_id = formData.get("schueler_id") as string;
  const paket_id = (formData.get("paket_id") as string) || null;
  const betrag = parseFloat(formData.get("betrag") as string);
  const methode = formData.get("methode") as string;
  const faellig_am = formData.get("faellig_am") as string;
  const rechnung_nr = (formData.get("rechnung_nr") as string) || null;

  const { error } = await supabase.from("zahlungen").insert({
    schueler_id,
    paket_id,
    betrag,
    status: "offen",
    methode,
    faellig_am,
    rechnung_nr,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/zahlungen");
  revalidatePath(`/admin/schueler/${schueler_id}`);
  return { success: true };
}

// ── Bewertungen ───────────────────────────────────────────────────────────────

export async function approveBewertung(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("bewertungen")
    .update({ anzeigen: true })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/bewertungen");
  return { success: true };
}

export async function rejectBewertung(id: string) {
  const supabase = await createClient();

  const { error } = await supabase.from("bewertungen").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/bewertungen");
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
    .select("buffer_time_minutes, vorname, nachname, email")
    .eq("id", req.student_id)
    .single();
  const bufferMin = profile?.buffer_time_minutes ?? DEFAULT_BUFFER_MIN;

  // Aktives, nutzbares Paket des Schülers
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

  const desiredStart = new Date(req.desired_start);
  const now = new Date();
  const starts = generateSeriesStarts(
    desiredStart,
    req.lessons_count,
    req.interval_days
  );
  const seriesEnd = new Date(starts[starts.length - 1].getTime() + 3600000);

  const ctx = await loadAvailabilityContext(
    admin,
    req.student_id,
    bufferMin,
    desiredStart,
    seriesEnd,
    now,
    { skipLeadTime: true }
  );
  const validation = validateSeries(
    desiredStart,
    req.lessons_count,
    req.interval_days,
    ctx
  );
  if (!validation.ok) {
    return {
      error:
        "Mindestens ein Termin der Serie ist nicht mehr verfügbar (Kollision/Abwesenheit).",
    };
  }

  const seriesId = req.lessons_count > 1 ? crypto.randomUUID() : null;
  const rows = slotsFromStarts(starts).map((s) => ({
    student_id: req.student_id,
    package_id: pkg.id,
    start_at: s.start.toISOString(),
    end_at: s.end.toISOString(),
    status: "booked",
    source: "public_request",
    series_id: seriesId,
  }));

  const { data: created, error: insertError } = await admin
    .from("appointments")
    .insert(rows)
    .select("id");

  if (insertError || !created) {
    return { error: "Termine konnten nicht erstellt werden." };
  }

  await admin
    .from("booking_requests")
    .update({
      status: "accepted",
      processed_at: new Date().toISOString(),
      created_appointment_ids: created.map((c) => c.id),
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

  const update: Record<string, number> = {};
  const fields = ["price_single", "price_10er", "price_20er", "travel_surcharge"] as const;
  for (const f of fields) {
    const v = parseFloat(formData.get(f) as string);
    if (!isNaN(v) && v >= 0) update[f] = v;
  }
  const buffer = parseInt(formData.get("buffer_time_minutes") as string);
  if (buffer === 15 || buffer === 30) update.buffer_time_minutes = buffer;

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
  const paymentMethod = (formData.get("payment_method") as string) || null;
  const pricePerLesson = parseFloat(formData.get("price_per_lesson") as string);

  if (!userId || !["single", "10er", "20er"].includes(type)) {
    return { error: "Ungültige Paketdaten." };
  }
  if (isNaN(pricePerLesson) || pricePerLesson < 0) {
    return { error: "Ungültiger Preis." };
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
  revalidatePath(`/admin/schueler/${schuelerId}`);
  revalidatePath("/admin/kalender");
  revalidatePath("/admin");
  return { success: true };
}

/** Termin stornieren (neues Schema). Gibt die Lektion wieder frei. */
export async function cancelAppointmentNew(id: string, schuelerId: string) {
  const admin = await createAdminClient();
  const { error } = await admin
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) return { error: error.message };
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
