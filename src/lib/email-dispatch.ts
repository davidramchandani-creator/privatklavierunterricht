import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email-sender";
import { renderEmail } from "@/lib/email-templates";
import { generateQRInvoicePdf, buildSpcData } from "@/lib/qr-invoice";
import { buildLessonTwintLink } from "@/lib/twint";
import { pricePerPersonFor } from "@/lib/group-courses";

export const ADMIN_RECIPIENT_TYPES = [
  "booking_request_admin",
  "booking_request_withdrawn",
  "appointment_cancelled_by_student",
  "reschedule_request_admin",
  "reschedule_request_withdrawn",
  "proposal_rejected_admin",
  "group_session_admin",
];

export const STUDENT_PAYLOAD_TO_TYPES = [
  "booking_request_received",
  "booking_confirmed",
  "reschedule_request_received",
  "reschedule_confirmed",
  "package_cancelled",
  "twint_payment_request",
  "qr_invoice",
  "payment_confirmed",
  "payment_rejected",
  "group_session_created",
  "group_session_joined",
  "group_session_left",
  "group_payment_request",
];

export const STUDENT_LOOKUP_TYPES = [
  "booking_rejected",
  "reschedule_rejected",
  "appointment_cancelled_student",
  "appointment_cancelled_by_admin",
  "proposal_new",
  "package_settlement_paid",
];

/**
 * Löst Empfänger auf, rendert das Template und sendet die Mail via Resend.
 * Wirft bei Fehlern (kein Empfänger, fehlendes Template, Senderfehler).
 * Wird sowohl für Sofortversand als auch vom Cron-Job genutzt.
 */
async function getDisabledEmailTypes(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "email_disabled_types")
    .maybeSingle();
  if (!data?.value) return [];
  return Array.isArray(data.value) ? (data.value as string[]) : [];
}

export async function dispatchEmail(
  admin: SupabaseClient,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Deaktivierte E-Mail-Typen überspringen.
  const disabled = await getDisabledEmailTypes(admin);
  if (disabled.includes(type)) return;

  let to: string | null = null;
  const extraContext: Record<string, unknown> = {};

  if (ADMIN_RECIPIENT_TYPES.includes(type)) {
    to = process.env.ADMIN_EMAIL ?? null;
    if (
      payload.student_id &&
      (type === "booking_request_withdrawn" ||
        type === "appointment_cancelled_by_student")
    ) {
      const { data: profile } = await admin
        .from("profiles")
        .select("vorname, nachname")
        .eq("id", payload.student_id)
        .single();
      if (profile)
        extraContext.student_name = `${profile.vorname} ${profile.nachname}`;
    }
  } else if (STUDENT_PAYLOAD_TO_TYPES.includes(type)) {
    to = (payload.to as string) ?? null;
  } else if (STUDENT_LOOKUP_TYPES.includes(type)) {
    if (payload.student_id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("email, vorname, nachname")
        .eq("id", payload.student_id)
        .single();
      if (profile) {
        to = profile.email;
        extraContext.student_name = `${profile.vorname} ${profile.nachname}`;
      }
    }
  }

  if (!to) throw new Error(`No recipient email resolved for type: ${type}`);

  // QR-Rechnung: PDF erzeugen und in Storage ablegen
  if (type === "qr_invoice" && payload.invoice_id) {
    const link = await ensureInvoicePdfLink(admin, String(payload.invoice_id));
    if (link) extraContext.pdf_link = link;
  }

  // TWINT: Deep-Link mit Betrag + Zahlungszweck (gehaltene Lektion) bauen.
  // Überschreibt einen evtl. im Payload gesetzten Basis-Link (Spec §6).
  if (type === "twint_payment_request") {
    extraContext.twint_link = buildLessonTwintLink(
      Number(payload.amount ?? 0),
      payload.lesson_date ? String(payload.lesson_date) : null
    );
  }

  // Gruppenkurs-Zahlung: Preis dynamisch aus der finalen Teilnehmerzahl
  // berechnen, Rechnung erst jetzt anlegen (nach der Lektion), dann TWINT/QR.
  if (type === "group_payment_request") {
    const group = await prepareGroupPayment(
      admin,
      String(payload.appointment_id ?? ""),
      String(payload.group_session_id ?? "")
    );
    Object.assign(extraContext, group);
  }

  const rendered = renderEmail(type, { ...payload, ...extraContext });
  if (!rendered) throw new Error(`No template for type: ${type}`);

  await sendEmail({ to, subject: rendered.subject, html: rendered.html });
}

/**
 * Stellt sicher, dass für eine Rechnung ein PDF (oder SPC-Fallback) existiert,
 * und gibt den signierten Download-Link zurück. Idempotent.
 */
async function ensureInvoicePdfLink(
  admin: SupabaseClient,
  invoiceId: string
): Promise<string | null> {
  const { data: inv } = await admin
    .from("invoices")
    .select("id, invoice_number, amount, payer_name, payer_address, pdf_url, access_token")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://privatklavierunterricht.ch";

  if (!inv.pdf_url) {
    const result = await generateQRInvoicePdf({
      invoiceNumber: inv.invoice_number ?? invoiceId,
      amount: Number(inv.amount ?? 0),
      debtorName: inv.payer_name ?? "Unbekannt",
      debtorAddress: inv.payer_address ?? "",
    });

    let pdfUrl: string;
    if (result.type === "pdf") {
      const storagePath = `invoices/${invoiceId}.pdf`;
      const { error: uploadErr } = await admin.storage
        .from("invoices")
        .upload(storagePath, result.pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });
      pdfUrl = uploadErr
        ? `spc:${buildSpcData({
            invoiceNumber: inv.invoice_number ?? invoiceId,
            amount: Number(inv.amount ?? 0),
            debtorName: inv.payer_name ?? "Unbekannt",
            debtorAddress: inv.payer_address ?? "",
          })}`
        : storagePath;
    } else {
      pdfUrl = `spc:${result.spcData}`;
    }

    await admin.from("invoices").update({ pdf_url: pdfUrl }).eq("id", invoiceId);
  }

  return `${appUrl}/api/invoices/${invoiceId}/pdf?token=${inv.access_token}`;
}

/**
 * Bereitet die Gruppenkurs-Abrechnung am Versandzeitpunkt vor: zählt die
 * tatsächlichen Teilnehmer, berechnet den Preis pro Person aus den Kurs-Tiers,
 * legt (idempotent) die Rechnung an und liefert den Render-Kontext (Betrag,
 * Methode, TWINT-Link oder PDF-Link). So gilt „mehr Leute = günstiger" auch
 * rückwirkend, weil die Lektion zu diesem Zeitpunkt vorbei ist.
 */
async function prepareGroupPayment(
  admin: SupabaseClient,
  appointmentId: string,
  sessionId: string
): Promise<Record<string, unknown>> {
  const { data: appt } = await admin
    .from("appointments")
    .select("id, student_id, start_at")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) throw new Error(`Group appointment not found: ${appointmentId}`);

  const { data: session } = await admin
    .from("group_sessions")
    .select("id, course_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) throw new Error(`Group session not found: ${sessionId}`);

  const { data: course } = await admin
    .from("group_courses")
    .select("id, title, price_tiers")
    .eq("id", session.course_id)
    .maybeSingle();
  if (!course) throw new Error(`Group course not found: ${session.course_id}`);

  const { count } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("group_session_id", sessionId)
    .in("status", ["booked", "completed"]);
  const participantCount = count ?? 1;
  const amount = pricePerPersonFor(
    { price_tiers: course.price_tiers as Record<string, number> },
    participantCount
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("vorname, nachname, adresse, payment_method")
    .eq("id", appt.student_id)
    .maybeSingle();
  const method: "twint" | "qr" =
    (profile?.payment_method as "twint" | "qr" | null) ?? "qr";
  const studentName = profile
    ? `${profile.vorname} ${profile.nachname}`
    : "Schüler";

  // Idempotenz: existiert schon eine Rechnung für diesen Termin?
  let invoiceId: string | null = null;
  let invoiceNumber: string | null = null;
  const { data: existing } = await admin
    .from("invoices")
    .select("id, invoice_number")
    .eq("appointment_id", appointmentId)
    .maybeSingle();
  if (existing) {
    invoiceId = existing.id;
    invoiceNumber = existing.invoice_number;
  } else {
    const { data: inv } = await admin
      .from("invoices")
      .insert({
        student_id: appt.student_id,
        appointment_id: appointmentId,
        group_session_id: sessionId,
        amount,
        payer_name: studentName,
        payer_address: profile?.adresse ?? null,
        status: "unpaid",
        method,
        lesson_date: appt.start_at,
      })
      .select("id, invoice_number")
      .maybeSingle();
    invoiceId = inv?.id ?? null;
    invoiceNumber = inv?.invoice_number ?? null;
  }

  const ctx: Record<string, unknown> = {
    student_name: studentName,
    course_title: course.title,
    lesson_date: appt.start_at,
    amount,
    method,
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    participant_count: participantCount,
  };
  if (method === "twint") {
    ctx.twint_link = buildLessonTwintLink(amount, appt.start_at, course.title);
  } else if (invoiceId) {
    const link = await ensureInvoicePdfLink(admin, invoiceId);
    if (link) ctx.pdf_link = link;
  }
  return ctx;
}
