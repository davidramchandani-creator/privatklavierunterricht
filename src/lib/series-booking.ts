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
  canBuyNewPackage,
  computePackageState,
} from "@/lib/packages";
import { buildTwintLink } from "@/lib/twint";
import { syncAppointmentToCalendar } from "@/lib/google-calendar";

/**
 * Bucht (ggf. als Serie) Termine für einen Schüler im neuen Schema.
 * Validiert transaktional gegen die Buchungs-Engine; 24h-Vorlauf wird als
 * Admin-/System-Aktion übersprungen. Legt pro Termin eine Rechnung an und plant
 * die Zahlungsmail auf `end_at` (Spec §6). Synchronisiert mit Google Calendar.
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
        await enqueueEmail(
          admin,
          "twint_payment_request",
          {
            ...basePayload,
            twint_link: buildTwintLink(amount, inv.invoice_number ?? inv.id),
          },
          sendAt
        );
      }
    }
  }

  // Google Calendar Sync (one-way, fehlertolerant)
  for (const c of created) {
    await syncAppointmentToCalendar(admin, c.id);
  }

  return { appointmentIds: created.map((c) => c.id) };
}
