import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email-sender";
import { renderEmail } from "@/lib/email-templates";
import { generateQRInvoicePdf, buildSpcData } from "@/lib/qr-invoice";
import { getTwintBaseUrl } from "@/lib/twint";

export const ADMIN_RECIPIENT_TYPES = [
  "booking_request_admin",
  "booking_request_withdrawn",
  "appointment_cancelled_by_student",
  "reschedule_request_admin",
  "reschedule_request_withdrawn",
  "proposal_rejected_admin",
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
export async function dispatchEmail(
  admin: SupabaseClient,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
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
    const invoiceId = String(payload.invoice_id);
    const { data: inv } = await admin
      .from("invoices")
      .select("id, invoice_number, amount, payer_name, payer_address, pdf_url, access_token")
      .eq("id", invoiceId)
      .maybeSingle();

    if (inv && !inv.pdf_url) {
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

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://privatklavierunterricht.ch";
      extraContext.pdf_link = `${appUrl}/api/invoices/${invoiceId}/pdf?token=${inv.access_token}`;
    } else if (inv?.pdf_url && inv.access_token) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://privatklavierunterricht.ch";
      extraContext.pdf_link = `${appUrl}/api/invoices/${invoiceId}/pdf?token=${inv.access_token}`;
    }
  }

  // TWINT: Acquirer-Link setzen
  if (type === "twint_payment_request" && !payload.twint_link) {
    extraContext.twint_link = getTwintBaseUrl();
  }

  const rendered = renderEmail(type, { ...payload, ...extraContext });
  if (!rendered) throw new Error(`No template for type: ${type}`);

  await sendEmail({ to, subject: rendered.subject, html: rendered.html });
}
