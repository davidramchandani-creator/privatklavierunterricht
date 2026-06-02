import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email-sender";
import { renderEmail } from "@/lib/email-templates";
import { generateQRInvoicePdf, buildSpcData } from "@/lib/qr-invoice";
import { buildTwintLink } from "@/lib/twint";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Auth check
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = await createAdminClient();

  // Fetch up to 20 pending emails due now
  const { data: emails } = await admin
    .from("scheduled_emails")
    .select("id, type, payload")
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(20);

  if (!emails?.length) return Response.json({ sent: 0 });

  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      const payload = email.payload as Record<string, unknown>;

      // Resolve recipient email for types that need DB lookup
      let to: string | null = null;
      const extraContext: Record<string, unknown> = {};

      const adminRecipientTypes = [
        "booking_request_admin",
        "booking_request_withdrawn",
        "appointment_cancelled_by_student",
        "reschedule_request_admin",
      ];
      const studentPayloadToTypes = [
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
      // Typen, deren Empfänger-Mail erst aus der profiles-Tabelle aufgelöst wird.
      const studentLookupTypes = ["booking_rejected", "reschedule_rejected"];

      if (adminRecipientTypes.includes(email.type)) {
        to = process.env.ADMIN_EMAIL ?? null;
        // For withdrawn/cancelled, look up student name
        if (
          payload.student_id &&
          (email.type === "booking_request_withdrawn" ||
            email.type === "appointment_cancelled_by_student")
        ) {
          const { data: profile } = await admin
            .from("profiles")
            .select("vorname, nachname")
            .eq("id", payload.student_id)
            .single();
          if (profile) {
            extraContext.student_name = `${profile.vorname} ${profile.nachname}`;
          }
        }
      } else if (studentPayloadToTypes.includes(email.type)) {
        to = (payload.to as string) ?? null;
      } else if (studentLookupTypes.includes(email.type)) {
        // Look up student email
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

      if (!to) throw new Error("No recipient email resolved");

      // QR-Rechnung: PDF erzeugen und in Storage ablegen, falls noch nicht vorhanden
      if (email.type === "qr_invoice" && payload.invoice_id) {
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
            if (uploadErr) {
              pdfUrl = `spc:${buildSpcData({
                invoiceNumber: inv.invoice_number ?? invoiceId,
                amount: Number(inv.amount ?? 0),
                debtorName: inv.payer_name ?? "Unbekannt",
                debtorAddress: inv.payer_address ?? "",
              })}`;
            } else {
              pdfUrl = storagePath;
            }
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

      // TWINT: Link aus invoice_id aufbauen wenn noch kein twint_link im payload
      if (email.type === "twint_payment_request" && payload.invoice_id && !payload.twint_link) {
        const invoiceId = String(payload.invoice_id);
        const { data: inv } = await admin
          .from("invoices")
          .select("invoice_number, amount")
          .eq("id", invoiceId)
          .maybeSingle();
        if (inv) {
          extraContext.twint_link = buildTwintLink(
            Number(inv.amount ?? 0),
            inv.invoice_number ?? invoiceId
          );
        }
      }

      const rendered = renderEmail(email.type, { ...payload, ...extraContext });
      if (!rendered) throw new Error(`No template for type: ${email.type}`);

      await sendEmail({ to, subject: rendered.subject, html: rendered.html });

      await admin
        .from("scheduled_emails")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", email.id);

      sent++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to send email ${email.id}:`, errMsg);

      await admin
        .from("scheduled_emails")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", email.id);

      failed++;
    }
  }

  return Response.json({ sent, failed });
}
