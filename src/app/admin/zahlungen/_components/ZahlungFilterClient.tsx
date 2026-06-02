"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, RotateCcw, Archive, Loader2 } from "lucide-react";
import {
  confirmInvoicePayment,
  rejectInvoicePayment,
  archiveInvoice,
  resendPaymentEmail,
} from "@/app/admin/actions";

export default function InvoiceActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string } | { success: boolean }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res && res.error) setError(res.error);
    });
  };

  if (isPending) {
    return <Loader2 className="w-4 h-4 animate-spin text-gray-400" />;
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {error && (
        <span className="text-xs text-red-600 w-full">{error}</span>
      )}

      {status === "pending_confirmation" && (
        <>
          <button
            onClick={() => run(() => confirmInvoicePayment(invoiceId))}
            className="inline-flex items-center gap-1 text-xs font-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Bestätigen
          </button>
          <button
            onClick={() => run(() => rejectInvoicePayment(invoiceId))}
            className="inline-flex items-center gap-1 text-xs font-600 text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            Ablehnen
          </button>
        </>
      )}

      {(status === "unpaid" || status === "rejected") && (
        <button
          onClick={() => run(() => resendPaymentEmail(invoiceId))}
          className="inline-flex items-center gap-1 text-xs font-600 text-gray-600 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Mail erneut
        </button>
      )}

      {["paid", "rejected", "unpaid"].includes(status) && (
        <button
          onClick={() => run(() => archiveInvoice(invoiceId))}
          className="inline-flex items-center gap-1 text-xs font-600 text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          title="Archivieren"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
