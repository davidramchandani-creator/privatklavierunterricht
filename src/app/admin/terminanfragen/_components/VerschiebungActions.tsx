"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { acceptReschedule, rejectReschedule } from "../../actions";

export default function VerschiebungActions({ rescheduleId }: { rescheduleId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptReschedule(rescheduleId);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleReject() {
    const reason =
      prompt("Optionaler Ablehnungsgrund (wird dem Schüler mitgeteilt):") ?? undefined;
    setError(null);
    startTransition(async () => {
      const result = await rejectReschedule(rescheduleId, reason);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          disabled={isPending}
          className="flex items-center gap-1.5 text-sm font-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          Verschieben
        </button>
        <button
          onClick={handleReject}
          disabled={isPending}
          className="flex items-center gap-1.5 text-sm font-600 text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          Ablehnen
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1 max-w-xs text-right">
          {error}
        </p>
      )}
    </div>
  );
}
