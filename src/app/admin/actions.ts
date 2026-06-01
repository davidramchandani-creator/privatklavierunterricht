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
