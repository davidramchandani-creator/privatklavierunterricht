import { createAdminClient } from "@/lib/supabase/server";
import { CreditCard } from "lucide-react";
import InvoiceActions from "./_components/InvoiceActions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  unpaid: "Offen",
  pending_confirmation: "Wird geprüft",
  paid: "Bezahlt",
  rejected: "Abgelehnt",
  archived: "Archiviert",
  cancelled: "Storniert",
};

const STATUS_COLORS: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-700",
  pending_confirmation: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  archived: "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-500",
};

const METHOD_LABELS: Record<string, string> = {
  twint: "TWINT",
  qr: "QR-Rechnung",
};

function fmtCHF(n: number): string {
  return (
    "CHF " +
    n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "–";
  try {
    return new Intl.DateTimeFormat("de-CH", {
      timeZone: "Europe/Zurich",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const FILTERS = ["alle", "unpaid", "pending_confirmation", "paid", "rejected"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABELS: Record<Filter, string> = {
  alle: "Alle",
  unpaid: "Offen",
  pending_confirmation: "Wird geprüft",
  paid: "Bezahlt",
  rejected: "Abgelehnt",
};

export default async function ZahlungenPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "alle" } = await searchParams;
  const admin = await createAdminClient();

  let query = admin
    .from("invoices")
    .select(
      "id, invoice_number, amount, status, method, lesson_date, paid_at, student_id, profiles(vorname, nachname)"
    )
    .not("status", "in", '("archived","cancelled")')
    .order("lesson_date", { ascending: false });

  if (filter !== "alle" && FILTERS.includes(filter as Filter)) {
    query = query.eq("status", filter);
  }

  const { data: invoices } = await query;

  // Summary stats
  const all = invoices ?? [];
  const totalOpen = all
    .filter((i) => i.status === "unpaid" || i.status === "rejected")
    .reduce((sum, i) => sum + Number(i.amount ?? 0), 0);
  const totalPending = all
    .filter((i) => i.status === "pending_confirmation")
    .reduce((sum, i) => sum + Number(i.amount ?? 0), 0);
  const totalPaid = all
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-800 text-[#1C244B]">Zahlungen</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 max-w-2xl">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-600 uppercase tracking-wide mb-1">Offen</p>
          <p className="text-xl font-800 text-amber-600">{fmtCHF(totalOpen)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-600 uppercase tracking-wide mb-1">Wird geprüft</p>
          <p className="text-xl font-800 text-blue-600">{fmtCHF(totalPending)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-600 uppercase tracking-wide mb-1">Bezahlt</p>
          <p className="text-xl font-800 text-emerald-600">{fmtCHF(totalPaid)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          {FILTERS.map((f) => (
            <a
              key={f}
              href={`/admin/zahlungen?filter=${f}`}
              className={`text-sm font-600 px-3.5 py-1.5 rounded-lg transition-colors ${
                filter === f
                  ? "bg-[#1C244B] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {FILTER_LABELS[f as Filter]}
            </a>
          ))}
        </div>

        {all.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Keine Zahlungen gefunden</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    "Schüler/in",
                    "Lektion",
                    "Betrag",
                    "Methode",
                    "Rechnung Nr.",
                    "Status",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-3 pr-4 last:pr-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {all.map((inv) => {
                  const rawProfile = inv.profiles;
                  const p =
                    rawProfile && !Array.isArray(rawProfile)
                      ? (rawProfile as unknown as { vorname: string; nachname: string })
                      : Array.isArray(rawProfile) && rawProfile.length > 0
                        ? (rawProfile[0] as { vorname: string; nachname: string })
                        : null;
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3.5 pr-4 text-sm font-500 text-gray-900">
                        {p ? `${p.vorname} ${p.nachname}` : "—"}
                      </td>
                      <td className="py-3.5 pr-4 text-sm text-gray-600 whitespace-nowrap">
                        {fmtDate(inv.lesson_date)}
                      </td>
                      <td className="py-3.5 pr-4 text-sm font-700 text-gray-900 whitespace-nowrap">
                        {fmtCHF(Number(inv.amount ?? 0))}
                      </td>
                      <td className="py-3.5 pr-4 text-sm text-gray-600">
                        {METHOD_LABELS[inv.method ?? ""] ?? inv.method ?? "—"}
                      </td>
                      <td className="py-3.5 pr-4 text-xs text-gray-500 font-mono">
                        {inv.invoice_number ?? "—"}
                      </td>
                      <td className="py-3.5 pr-4">
                        <span
                          className={`text-xs font-600 px-2.5 py-1 rounded-full whitespace-nowrap ${
                            STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {STATUS_LABELS[inv.status] ?? inv.status}
                        </span>
                        {inv.status === "paid" && inv.paid_at && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {fmtDate(inv.paid_at)}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5">
                        <InvoiceActions invoiceId={inv.id} status={inv.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
