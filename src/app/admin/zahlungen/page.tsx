import { createAdminClient } from "@/lib/supabase/server";
import PaymentsBoard from "./_components/PaymentsBoard";
import type { Invoice } from "./_components/PaymentCard";

export const dynamic = "force-dynamic";

export default async function ZahlungenPage() {
  const admin = await createAdminClient();

  const { data } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, amount, status, method, lesson_date, paid_at, student_id, profiles(vorname, nachname)"
    )
    .order("lesson_date", { ascending: false, nullsFirst: false })
    .limit(500);

  const invoices: Invoice[] = (data ?? []).map((inv) => {
    const raw = inv.profiles as unknown;
    const p =
      raw && !Array.isArray(raw)
        ? (raw as { vorname: string; nachname: string })
        : Array.isArray(raw) && raw.length > 0
          ? (raw[0] as { vorname: string; nachname: string })
          : null;
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      amount: Number(inv.amount ?? 0),
      status: inv.status,
      method: inv.method,
      lesson_date: inv.lesson_date,
      paid_at: inv.paid_at,
      studentName: p ? `${p.vorname} ${p.nachname}`.trim() : "—",
    };
  });

  return <PaymentsBoard invoices={invoices} />;
}
