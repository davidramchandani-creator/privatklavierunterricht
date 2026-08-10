"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  Bell,
  Archive,
  Trash2,
  MoreHorizontal,
  Loader2,
  CreditCard,
  QrCode,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  confirmInvoicePayment,
  rejectInvoicePayment,
  archiveInvoice,
  resendPaymentEmail,
  hardDeleteInvoice,
} from "@/app/admin/actions";

export type Invoice = {
  id: string;
  invoice_number: string | null;
  amount: number;
  status: string;
  method: string | null;
  lesson_date: string | null;
  paid_at: string | null;
  studentName: string;
  /** z. B. "10er-Paket – Rate 2/4"; bei Lektionsrechnungen leer. */
  description?: string | null;
  due_date?: string | null;
};

function fmtCHF(n: number): string {
  return "CHF " + n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("de-CH", {
      timeZone: "Europe/Zurich",
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

type SheetAction = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
};

export default function PaymentCard({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [isPending, startTransition] = useTransition();
  const [sheet, setSheet] = useState<null | "more" | "reject">(null);
  const [reason, setReason] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { id, status } = invoice;

  const run = (
    fn: () => Promise<{ error?: string } | { success: boolean }>,
    successFlash?: string
  ) => {
    setError(null);
    setSheet(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if (successFlash) setFlash(successFlash);
      router.refresh();
    });
  };

  const MethodIcon = invoice.method === "qr" ? QrCode : CreditCard;
  const methodLabel = invoice.method === "qr" ? "QR-Rechnung" : invoice.method === "twint" ? "TWINT" : "—";

  // Aktionen für das Overflow-Sheet je nach Status
  const sheetActions: SheetAction[] = [];
  if (status === "pending_confirmation") {
    sheetActions.push({
      label: "Erinnerung senden",
      icon: <Bell className="w-5 h-5" />,
      onClick: () => run(() => resendPaymentEmail(id), "Erinnert"),
    });
    sheetActions.push({
      label: "Archivieren",
      icon: <Archive className="w-5 h-5" />,
      onClick: () => run(() => archiveInvoice(id), "Archiviert"),
    });
  } else if (status === "unpaid" || status === "rejected") {
    sheetActions.push({
      label: "Als bezahlt markieren",
      icon: <Check className="w-5 h-5" />,
      onClick: () => run(() => confirmInvoicePayment(id), "Bestätigt"),
    });
    sheetActions.push({
      label: "Archivieren",
      icon: <Archive className="w-5 h-5" />,
      onClick: () => run(() => archiveInvoice(id), "Archiviert"),
    });
  } else if (status === "paid") {
    sheetActions.push({
      label: "Archivieren",
      icon: <Archive className="w-5 h-5" />,
      onClick: () => run(() => archiveInvoice(id), "Archiviert"),
    });
  } else if (status === "archived" || status === "cancelled") {
    sheetActions.push({
      label: "Endgültig löschen",
      icon: <Trash2 className="w-5 h-5" />,
      tone: "danger",
      onClick: () => run(() => hardDeleteInvoice(id), "Gelöscht"),
    });
  }

  return (
    <div
      className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-opacity"
      style={{ opacity: flash ? 0.55 : 1 }}
    >
      {/* Busy / Flash overlay */}
      {(isPending || flash) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
          {flash ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-700 text-emerald-600">
              <Check className="w-4 h-4" /> {flash}
            </span>
          ) : (
            <Loader2 className="w-5 h-5 animate-spin text-navy-900" />
          )}
        </div>
      )}

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-navy-900/8 flex items-center justify-center text-[13px] font-700 text-navy-900">
            {initials(invoice.studentName) || "?"}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="font-700 text-[15px] text-gray-900 truncate">{invoice.studentName}</p>
              <p className="font-800 text-[15px] text-gray-900 whitespace-nowrap tabular-nums">
                {fmtCHF(Number(invoice.amount ?? 0))}
              </p>
            </div>

            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-gray-400 min-w-0">
              <MethodIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">
                {invoice.lesson_date
                  ? fmtDate(invoice.lesson_date)
                  : invoice.description
                    ? invoice.description
                    : invoice.due_date
                      ? `zahlbar bis ${fmtDate(invoice.due_date)}`
                      : "Rechnung"}{" "}
                · {methodLabel}
                {invoice.invoice_number ? ` · ${invoice.invoice_number}` : ""}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <StatusBadge kind="payment" status={status} />
              {status === "paid" && invoice.paid_at && (
                <span className="text-[11px] text-gray-400">bezahlt {fmtDate(invoice.paid_at)}</span>
              )}
            </div>
          </div>
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      {/* Action bar */}
      <div className="flex items-stretch border-t border-gray-100 divide-x divide-gray-100">
        {status === "pending_confirmation" && (
          <>
            <button
              onClick={() => run(() => confirmInvoicePayment(id), "Bestätigt")}
              className="press flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-700 text-emerald-600 active:bg-emerald-50"
            >
              <Check className="w-4 h-4" /> Bestätigen
            </button>
            <button
              onClick={() => setSheet("reject")}
              className="press flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-700 text-red-500 active:bg-red-50"
            >
              <X className="w-4 h-4" /> Ablehnen
            </button>
          </>
        )}

        {(status === "unpaid" || status === "rejected") && (
          <button
            onClick={() => run(() => resendPaymentEmail(id), "Erinnert")}
            className="press flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-700 text-navy-900 active:bg-navy-50"
          >
            <Bell className="w-4 h-4" /> Erinnern
          </button>
        )}

        {status === "paid" && (
          <button
            onClick={() => run(() => archiveInvoice(id), "Archiviert")}
            className="press flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-600 text-gray-500 active:bg-gray-50"
          >
            <Archive className="w-4 h-4" /> Archivieren
          </button>
        )}

        {(status === "archived" || status === "cancelled") && (
          <button
            onClick={() => run(() => hardDeleteInvoice(id), "Gelöscht")}
            className="press flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-600 text-red-500 active:bg-red-50"
          >
            <Trash2 className="w-4 h-4" /> Löschen
          </button>
        )}

        {/* Overflow */}
        {sheetActions.length > 1 || (status !== "archived" && status !== "cancelled" && status !== "paid") ? (
          <button
            onClick={() => setSheet("more")}
            aria-label="Weitere Aktionen"
            className="press px-4 flex items-center justify-center text-gray-400 active:bg-gray-50"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        ) : null}
      </div>

      {/* Bottom sheets – via Portal an document.body, damit sie nicht von
          transformierten/overflow-hidden-Vorfahren zerschossen werden. */}
      {mounted && sheet && createPortal(
        <div className="fixed inset-0 z-[100]" onClick={() => setSheet(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in" />
          <div
            className="liquid-glass-bar liquid-glass-bar--bottom absolute bottom-0 left-0 right-0 mx-auto max-w-lg rounded-t-[28px] sm:bottom-4 sm:rounded-[28px] animate-slide-in"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="w-9 h-1 rounded-full bg-navy-900/15" />
            </div>

            {/* Context header */}
            <div className="px-5 pt-2 pb-3">
              <p className="text-sm font-700 text-gray-900">{invoice.studentName}</p>
              <p className="text-xs text-gray-400">
                {fmtCHF(Number(invoice.amount ?? 0))} ·{" "}
                {invoice.lesson_date
                  ? fmtDate(invoice.lesson_date)
                  : (invoice.description ?? "Rechnung")}
              </p>
            </div>

            {sheet === "reject" ? (
              <div className="px-4 pb-4 space-y-3">
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Grund (optional, geht an Schüler:in)"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-200"
                  autoFocus
                />
                <button
                  onClick={() => run(() => rejectInvoicePayment(id, reason || undefined), "Abgelehnt")}
                  className="press w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-500 text-white text-sm font-700 active:bg-red-600"
                >
                  <X className="w-4 h-4" /> Zahlung ablehnen
                </button>
                <button
                  onClick={() => setSheet(null)}
                  className="press w-full py-3 rounded-xl text-sm font-600 text-gray-500 active:bg-gray-100"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <div className="px-4 pb-4 space-y-1">
                {sheetActions.map((a) => (
                  <button
                    key={a.label}
                    onClick={a.onClick}
                    className={`press w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-600 active:bg-black/5 ${
                      a.tone === "danger" ? "text-red-500" : "text-gray-800"
                    }`}
                  >
                    <span className={a.tone === "danger" ? "text-red-500" : "text-gray-400"}>{a.icon}</span>
                    {a.label}
                  </button>
                ))}
                <button
                  onClick={() => setSheet(null)}
                  className="press w-full py-3 mt-1 rounded-xl text-sm font-600 text-gray-500 active:bg-gray-100"
                >
                  Abbrechen
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
