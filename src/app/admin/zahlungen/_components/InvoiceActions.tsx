"use client";

import { useTransition, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Archive, Mail, ChevronDown } from "lucide-react";
import {
  confirmInvoicePayment,
  rejectInvoicePayment,
  archiveInvoice,
  resendPaymentEmail,
} from "@/app/admin/actions";

type InvoiceActionsProps = {
  invoiceId: string;
  status: string;
};

export default function InvoiceActions({ invoiceId, status }: InvoiceActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (done) {
    return <span className="text-xs text-gray-400">Erledigt</span>;
  }

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const res = await confirmInvoicePayment(invoiceId);
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setDone(true);
      }
    });
  };

  const handleReject = () => {
    setError(null);
    startTransition(async () => {
      const res = await rejectInvoicePayment(invoiceId, rejectReason || undefined);
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setDone(true);
      }
    });
  };

  const handleArchive = () => {
    setError(null);
    startTransition(async () => {
      const res = await archiveInvoice(invoiceId);
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setDone(true);
      }
    });
  };

  const handleResend = () => {
    setError(null);
    startTransition(async () => {
      const res = await resendPaymentEmail(invoiceId);
      if ("error" in res && res.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-1.5 items-end">
      {error && (
        <p className="text-xs text-red-600 max-w-48 text-right">{error}</p>
      )}

      {status === "pending_confirmation" && (
        <div className="flex gap-1.5">
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-xs font-600 text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            Bestätigen
          </button>
          <button
            onClick={() => setShowRejectForm(!showRejectForm)}
            disabled={isPending}
            className="inline-flex items-center gap-1 text-xs font-600 text-white bg-red-500 hover:bg-red-600 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <XCircle className="w-3 h-3" />
            Ablehnen
            <ChevronDown className={`w-3 h-3 transition-transform ${showRejectForm ? "rotate-180" : ""}`} />
          </button>
        </div>
      )}

      {showRejectForm && (
        <div className="flex gap-1.5 mt-1">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Grund (optional)"
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 w-40 focus:outline-none focus:ring-1 focus:ring-red-300"
          />
          <button
            onClick={handleReject}
            disabled={isPending}
            className="text-xs font-600 text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Senden"}
          </button>
        </div>
      )}

      <div className="flex gap-1.5">
        <button
          onClick={handleResend}
          disabled={isPending}
          title="E-Mail erneut senden"
          className="inline-flex items-center gap-1 text-xs font-500 text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <Mail className="w-3 h-3" />
          Mail
        </button>
        <button
          onClick={handleArchive}
          disabled={isPending}
          title="Archivieren"
          className="inline-flex items-center gap-1 text-xs font-500 text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <Archive className="w-3 h-3" />
          Archiv
        </button>
      </div>
    </div>
  );
}
