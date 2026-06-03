"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  XCircle,
  FileText,
  RefreshCw,
} from "lucide-react";
import { markInvoicePaid } from "@/app/schueler/portal/actions";
import { StatusBadge } from "@/components/ui/status-badge";

type Invoice = {
  id: string;
  invoice_number: string | null;
  amount: number;
  status: string;
  method: string | null;
  lesson_date: string | null;
  pdf_url: string | null;
  access_token: string | null;
  appointment_id: string | null;
};

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("de-CH", {
      timeZone: "Europe/Zurich",
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function fmtCHF(n: number): string {
  return "CHF " + n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lessonHasPassed(lessonDate: string | null): boolean {
  if (!lessonDate) return false;
  // Show payment button/link only after lesson end (approx +45min)
  const end = new Date(new Date(lessonDate).getTime() + 45 * 60 * 1000);
  return end <= new Date();
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(invoice.status);
  const [error, setError] = useState<string | null>(null);

  const passed = lessonHasPassed(invoice.lesson_date);
  const pdfLink = invoice.access_token
    ? `/api/invoices/${invoice.id}/pdf?token=${invoice.access_token}`
    : null;

  // TWINT link: built from invoice_number + amount
  const twintBase =
    "https://go.twint.ch/1/e/tw?tw=acq.6YabPo0CSR6u1rxllpn-W0WWPnkfZMQnBMX_JvCpUKrIMZZJaBhIz5pjf-UeImB-.";
  const twintLink = invoice.invoice_number
    ? `${twintBase}&trxInfo=${encodeURIComponent(invoice.invoice_number ?? "")}&amount=${invoice.amount.toFixed(2)}`
    : null;

  const handleMarkPaid = () => {
    setError(null);
    startTransition(async () => {
      const res = await markInvoicePaid(invoice.id);
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setLocalStatus("pending_confirmation");
      }
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-600 text-gray-900">
            {invoice.lesson_date ? fmtDate(invoice.lesson_date) : "Klavierstunde"}
          </p>
          {invoice.invoice_number && (
            <p className="text-xs text-gray-400 mt-0.5">{invoice.invoice_number}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-base font-700 text-[#1C244B]">{fmtCHF(invoice.amount)}</span>
          <StatusBadge kind="payment" status={localStatus} />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Actions – only visible after lesson + not already confirmed/paid */}
      {passed && (localStatus === "unpaid" || localStatus === "rejected") && (
        <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2">
          {invoice.method === "twint" && twintLink && (
            <a
              href={twintLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-600 text-white bg-[#1C244B] px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Per TWINT bezahlen
            </a>
          )}
          {invoice.method === "qr" && pdfLink && (
            <a
              href={pdfLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-600 text-white bg-[#1C244B] px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              <FileText className="w-3.5 h-3.5" />
              Rechnung herunterladen
            </a>
          )}
          <button
            onClick={handleMarkPaid}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-sm font-600 text-[#1C244B] bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Ich habe bezahlt
          </button>
        </div>
      )}

      {localStatus === "pending_confirmation" && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-navy-900 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Deine Zahlung wird geprüft. Du erhältst eine Bestätigung per E-Mail.
          </p>
        </div>
      )}

      {localStatus === "paid" && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Zahlung bestätigt – danke!
          </p>
        </div>
      )}

      {localStatus === "rejected" && !passed && (
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs text-red-700 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            Zahlung nicht gefunden. Bitte erneut bezahlen.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ZahlungenSection({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
        <p className="text-sm text-gray-500">Keine Zahlungen vorhanden</p>
      </div>
    );
  }

  const openInvoices = invoices.filter((i) => i.status === "unpaid" || i.status === "rejected");
  const pendingInvoices = invoices.filter((i) => i.status === "pending_confirmation");
  const paidInvoices = invoices.filter((i) => i.status === "paid");

  return (
    <div className="space-y-6">
      {openInvoices.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-600 text-amber-700">
              {openInvoices.length} offene Zahlung{openInvoices.length !== 1 ? "en" : ""}
            </p>
          </div>
          {openInvoices.map((inv) => (
            <InvoiceRow key={inv.id} invoice={inv} />
          ))}
        </div>
      )}

      {pendingInvoices.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-navy-700" />
            <p className="text-sm font-600 text-navy-900">
              {pendingInvoices.length} Zahlung{pendingInvoices.length !== 1 ? "en" : ""} wird geprüft
            </p>
          </div>
          {pendingInvoices.map((inv) => (
            <InvoiceRow key={inv.id} invoice={inv} />
          ))}
        </div>
      )}

      {paidInvoices.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <p className="text-sm font-600 text-emerald-700">Bezahlte Rechnungen</p>
          </div>
          {paidInvoices.map((inv) => (
            <InvoiceRow key={inv.id} invoice={inv} />
          ))}
        </div>
      )}
    </div>
  );
}
