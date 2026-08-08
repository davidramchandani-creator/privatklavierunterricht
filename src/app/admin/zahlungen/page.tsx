import { createAdminClient } from "@/lib/supabase/server";
import PaymentsBoard from "./_components/PaymentsBoard";
import RatenBoard, { type RatenZeile } from "./_components/RatenBoard";
import ZahlungenTabs from "./_components/ZahlungenTabs";
import type { Invoice } from "./_components/PaymentCard";
import { buildPlanSummary, type InstalmentRow } from "@/lib/instalment-view";
import { PACKAGE_LABELS } from "@/lib/packages";

export const dynamic = "force-dynamic";

type ProfilRef = { vorname: string; nachname: string } | null;

function nameOf(raw: unknown): ProfilRef {
  if (raw && !Array.isArray(raw)) return raw as { vorname: string; nachname: string };
  if (Array.isArray(raw) && raw.length > 0)
    return raw[0] as { vorname: string; nachname: string };
  return null;
}

export default async function ZahlungenPage() {
  const admin = await createAdminClient();

  const { data } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, amount, status, method, lesson_date, paid_at, description, due_date, student_id, profiles(vorname, nachname)"
    )
    .order("lesson_date", { ascending: false, nullsFirst: false })
    .limit(500);

  const invoices: Invoice[] = (data ?? []).map((inv) => {
    const p = nameOf(inv.profiles);
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      amount: Number(inv.amount ?? 0),
      status: inv.status,
      method: inv.method,
      lesson_date: inv.lesson_date,
      paid_at: inv.paid_at,
      description: inv.description,
      due_date: inv.due_date,
      studentName: p ? `${p.vorname} ${p.nachname}`.trim() : "—",
    };
  });

  // ── Raten aller Schüler, gruppiert nach Paket ──────────────────────
  const { data: instalments } = await admin
    .from("package_instalments")
    .select(
      "id, package_id, student_id, sequence, kind, amount, due_date, status, invoice_id, paid_at, profiles(vorname, nachname), packages(type, name)"
    )
    .order("due_date", { ascending: true })
    .limit(500);

  // Pro Paket eine Plan-Zusammenfassung bauen, damit "Rate 2 von 4"
  // und der Überfällig-Zustand identisch zum Portal berechnet werden.
  const byPackage = new Map<string, typeof instalments>();
  for (const row of instalments ?? []) {
    const list = byPackage.get(row.package_id) ?? [];
    list.push(row);
    byPackage.set(row.package_id, list as typeof instalments);
  }

  const zeilen: RatenZeile[] = [];
  for (const rows of byPackage.values()) {
    if (!rows || rows.length === 0) continue;
    const summary = buildPlanSummary(rows as unknown as InstalmentRow[]);
    const first = rows[0];
    const p = nameOf(first.profiles);
    const pkg = nameOf(first.packages) as unknown as
      | { type: string; name: string | null }
      | null;
    const studentName = p ? `${p.vorname} ${p.nachname}`.trim() : "Unbekannt";
    const packageLabel =
      pkg?.name ?? (pkg ? PACKAGE_LABELS[pkg.type] ?? pkg.type : "Paket");

    for (const e of summary.entries) {
      if (e.state === "storniert") continue;
      zeilen.push({
        id: e.id,
        studentId: first.student_id,
        studentName,
        packageLabel,
        label: e.label,
        amount: e.amount,
        dueDate: e.dueDate,
        state: e.state,
        daysUntilDue: e.daysUntilDue,
        invoiceId: e.invoiceId,
      });
    }
  }

  const zuErledigen = zeilen.filter(
    (z) => z.state === "ueberfaellig" || z.state === "offen" || z.state === "in_pruefung"
  ).length;

  return (
    <ZahlungenTabs
      ratenBadge={zuErledigen}
      rechnungen={<PaymentsBoard invoices={invoices} />}
      raten={<RatenBoard zeilen={zeilen} />}
    />
  );
}
