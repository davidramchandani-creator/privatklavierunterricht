import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueEmail } from "@/lib/emails-outbox";
import { PACKAGE_LABELS } from "@/lib/packages";

/** Zahlungsfrist für Paket-Rechnungen in Tagen (Spec: Zahlung innert 15 Tagen fällig). */
export const PACKAGE_INVOICE_DUE_DAYS = 15;

type PackageRow = {
  id: string;
  student_id: string;
  type: string;
  total_price: number | string | null;
  price_per_lesson: number | string | null;
  payment_method: string | null;
};

type ProfileRow = {
  vorname: string | null;
  nachname: string | null;
  adresse: string | null;
  email: string | null;
  payment_method: string | null;
};

/**
 * Erstellt im Voraus eine einzige Rechnung über den gesamten Paketpreis und
 * plant die Zahlungsmail (TWINT/QR) sofort in die Outbox ein.
 *
 * Ersetzt die frühere Pro-Lektion-Abrechnung: sobald ein Paket gebucht wird,
 * wird der volle `total_price` in Rechnung gestellt. Das Paket bleibt sofort
 * buchbar; die Zahlung ist innert 15 Tagen fällig.
 */
export async function createPackageInvoice(
  admin: SupabaseClient,
  pkg: PackageRow,
  profile: ProfileRow
): Promise<{ invoiceId: string } | { error: string }> {
  // Zahlungsart: Paket hat Vorrang, dann Profil, dann QR als Default.
  const method: "twint" | "qr" =
    ((pkg.payment_method as "twint" | "qr" | null) ??
      (profile.payment_method as "twint" | "qr" | null)) ??
    "qr";

  const amount = Number(
    pkg.total_price ?? Number(pkg.price_per_lesson ?? 0)
  );
  const studentName = `${profile.vorname ?? ""} ${profile.nachname ?? ""}`.trim() || "Schüler";
  const description = PACKAGE_LABELS[pkg.type] ?? pkg.type;

  const dueDate = new Date(
    Date.now() + PACKAGE_INVOICE_DUE_DAYS * 24 * 60 * 60 * 1000
  );

  const { data: inv, error } = await admin
    .from("invoices")
    .insert({
      student_id: pkg.student_id,
      package_id: pkg.id,
      amount,
      payer_name: studentName,
      payer_address: profile.adresse ?? null,
      status: "unpaid",
      method,
      lesson_date: null,
      due_date: dueDate.toISOString(),
      description,
    })
    .select("id, invoice_number")
    .maybeSingle();

  if (error || !inv) {
    return { error: error?.message ?? "Rechnung konnte nicht erstellt werden." };
  }

  // Zahlungsmail sofort einreihen (send_at = now); der Cron versendet sie
  // robust inkl. PDF-Erzeugung, ohne den Paketkauf zu blockieren.
  if (profile.email) {
    const payload = {
      to: profile.email,
      student_name: studentName,
      student_id: pkg.student_id,
      amount,
      invoice_number: inv.invoice_number,
      invoice_id: inv.id,
      package_id: pkg.id,
      description,
      due_date: dueDate.toISOString(),
    };
    const type = method === "qr" ? "qr_invoice" : "twint_payment_request";
    await enqueueEmail(admin, type, payload, new Date());
  }

  return { invoiceId: inv.id };
}
