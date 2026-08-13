import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_BUFFER_MIN,
  LESSON_DURATION_MIN,
  generateSeriesStarts,
  slotsFromStarts,
  validateSeries,
} from "@/lib/booking";
import { loadAvailabilityContext } from "@/lib/booking-server";
import {
  type Package as Paket,
  canBuyNewPackage,
  computePackageState,
} from "@/lib/packages";
import { syncAppointmentToCalendar } from "@/lib/google-calendar";
import { scheduleLessonReminders } from "@/lib/reminders";

/**
 * Bucht (ggf. als Serie) Termine für einen Schüler im neuen Schema.
 * Validiert transaktional gegen die Buchungs-Engine; 24h-Vorlauf wird als
 * Admin-/System-Aktion übersprungen. Synchronisiert mit Google Calendar.
 * Es entstehen KEINE Rechnungen pro Lektion, die Abrechnung läuft im Voraus
 * über den Paketpreis (siehe createPackageInvoice).
 *
 * Wird genutzt von: Admin-Direktbuchung, Anfrage-Annahme (Admin) und
 * Terminvorschlag-Annahme (Schüler). Der Aufrufer übergibt einen Admin-Client
 * (Service-Role), da appointments/invoices per RLS admin-only sind.
 */
export async function bookSeriesForStudent(
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
  const seriesEnd = new Date(
    starts[starts.length - 1].getTime() + LESSON_DURATION_MIN * 60000
  );

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

  // Hinweis: Es werden keine Rechnungen/Zahlungsmails pro Lektion mehr erstellt.
  // Die Abrechnung erfolgt im Voraus über den gesamten Paketpreis beim Paketkauf
  // (siehe createPackageInvoice / buyPackage / createPackageAdmin).

  // Termin-Erinnerungen (24h / 2h vorher) einplanen.
  for (let i = 0; i < created.length; i++) {
    const row = rows[i];
    if (!row) continue;
    await scheduleLessonReminders(admin, {
      id: created[i].id,
      student_id: studentUserId,
      start_at: row.start_at,
    });
  }

  // Google Calendar Sync (one-way, fehlertolerant)
  for (const c of created) {
    await syncAppointmentToCalendar(admin, c.id);
  }

  return { appointmentIds: created.map((c) => c.id) };
}
