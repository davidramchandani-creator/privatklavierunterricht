"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteBookingRequest, deleteRescheduleRequest } from "../../actions";

export function DeleteBookingRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="text-xs text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
        title="Löschen"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 bg-red-50 rounded-lg px-2 py-1">
      <span className="text-xs text-red-700">Sicher?</span>
      <button
        onClick={() => {
          startTransition(async () => {
            await deleteBookingRequest(requestId);
            router.refresh();
          });
        }}
        disabled={isPending}
        className="text-xs font-600 text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Ja"}
      </button>
      <button
        onClick={() => setConfirm(false)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Nein
      </button>
    </div>
  );
}

export function DeleteRescheduleRequestButton({ rescheduleId }: { rescheduleId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="text-xs text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
        title="Löschen"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 bg-red-50 rounded-lg px-2 py-1">
      <span className="text-xs text-red-700">Sicher?</span>
      <button
        onClick={() => {
          startTransition(async () => {
            await deleteRescheduleRequest(rescheduleId);
            router.refresh();
          });
        }}
        disabled={isPending}
        className="text-xs font-600 text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Ja"}
      </button>
      <button
        onClick={() => setConfirm(false)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Nein
      </button>
    </div>
  );
}
