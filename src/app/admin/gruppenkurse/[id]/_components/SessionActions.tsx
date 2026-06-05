"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, UserMinus } from "lucide-react";
import { adminCancelGroupSession, adminRemoveParticipant } from "../../../actions";

export function CancelSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle() {
    if (!confirm("Session absagen? Alle Teilnehmer werden benachrichtigt.")) return;
    setError(null);
    startTransition(async () => {
      const result = await adminCancelGroupSession(sessionId);
      if (result && "error" in result) setError(result.error ?? "Fehler");
      else router.refresh();
    });
  }

  return (
    <div>
      <button
        onClick={handle}
        disabled={isPending}
        className="flex items-center gap-1.5 text-xs font-600 text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        Session absagen
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function RemoveParticipantButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle() {
    if (!confirm("Teilnehmer entfernen?")) return;
    setError(null);
    startTransition(async () => {
      const result = await adminRemoveParticipant(appointmentId);
      if (result && "error" in result) setError(result.error ?? "Fehler");
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handle}
        disabled={isPending}
        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
        title="Teilnehmer entfernen"
      >
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
