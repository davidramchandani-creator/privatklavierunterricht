"use client";

import { useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import PaymentCard, { type Invoice } from "./PaymentCard";
import BulkDeleteArchivedButton from "./BulkDeleteArchivedButton";

const FILTERS = [
  { id: "offen", label: "Zu erledigen" },
  { id: "pending_confirmation", label: "In Prüfung" },
  { id: "unpaid", label: "Offen" },
  { id: "paid", label: "Bezahlt" },
  { id: "rejected", label: "Abgelehnt" },
  { id: "archived", label: "Archiv" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function matches(inv: Invoice, f: FilterId): boolean {
  switch (f) {
    case "offen":
      // Alles, was Aufmerksamkeit braucht
      return ["pending_confirmation", "unpaid", "rejected"].includes(inv.status);
    case "archived":
      return inv.status === "archived" || inv.status === "cancelled";
    default:
      return inv.status === f;
  }
}

function fmtCHF(n: number): string {
  return "CHF " + n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PaymentsBoard({ invoices }: { invoices: Invoice[] }) {
  const [filter, setFilter] = useState<FilterId>("offen");

  const counts = useMemo(() => {
    const c: Record<FilterId, number> = {
      offen: 0,
      pending_confirmation: 0,
      unpaid: 0,
      paid: 0,
      rejected: 0,
      archived: 0,
    };
    for (const inv of invoices) {
      for (const f of FILTERS) if (matches(inv, f.id)) c[f.id]++;
    }
    return c;
  }, [invoices]);

  const totals = useMemo(() => {
    let open = 0,
      pending = 0,
      paid = 0;
    for (const inv of invoices) {
      const a = Number(inv.amount ?? 0);
      if (inv.status === "unpaid" || inv.status === "rejected") open += a;
      else if (inv.status === "pending_confirmation") pending += a;
      else if (inv.status === "paid") paid += a;
    }
    return { open, pending, paid };
  }, [invoices]);

  const list = useMemo(
    () => invoices.filter((inv) => matches(inv, filter)),
    [invoices, filter]
  );

  const archivedCount = counts.archived;

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-800 text-[#1C244B]">Zahlungen</h1>
      </div>

      {/* Summary – kompakte Glas-Statistik */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3 min-w-0">
          <p className="text-[10px] font-700 uppercase tracking-wide text-amber-600/70 mb-0.5 truncate">Offen</p>
          <p className="text-[15px] sm:text-lg font-800 text-amber-600 leading-tight tabular-nums">{fmtCHF(totals.open)}</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3 min-w-0">
          <p className="text-[10px] font-700 uppercase tracking-wide text-blue-600/70 mb-0.5 truncate">Prüfung</p>
          <p className="text-[15px] sm:text-lg font-800 text-blue-600 leading-tight tabular-nums">{fmtCHF(totals.pending)}</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-3 min-w-0">
          <p className="text-[10px] font-700 uppercase tracking-wide text-emerald-600/70 mb-0.5 truncate">Bezahlt</p>
          <p className="text-[15px] sm:text-lg font-800 text-emerald-600 leading-tight tabular-nums">{fmtCHF(totals.paid)}</p>
        </div>
      </div>

      {/* Filter-Chips – horizontal scrollbar, native */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 mb-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 w-max">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const count = counts[f.id];
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`press flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-600 transition-colors ${
                  active ? "bg-[#1C244B] text-white" : "bg-white border border-gray-200 text-gray-600"
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-700 ${
                      active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste */}
      {list.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CreditCard className="w-9 h-9 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-500">Nichts hier</p>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {list.map((inv) => (
            <PaymentCard key={inv.id} invoice={inv} />
          ))}
        </div>
      )}

      {filter === "archived" && archivedCount > 0 && (
        <div className="mt-5 flex justify-center">
          <BulkDeleteArchivedButton count={archivedCount} />
        </div>
      )}
    </div>
  );
}
