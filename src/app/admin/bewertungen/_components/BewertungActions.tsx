"use client";

import { useTransition } from "react";
import { approveBewertung, rejectBewertung } from "../../actions";
import { CheckCircle2, Trash2, Loader2 } from "lucide-react";

export default function BewertungActions({
  id,
  approved = false,
}: {
  id: string;
  approved?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2 pt-1">
      {!approved && (
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await approveBewertung(id);
            })
          }
          className="flex items-center gap-1.5 text-xs font-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3 h-3" />
          )}
          Genehmigen
        </button>
      )}
      <button
        disabled={isPending}
        onClick={() => {
          if (!confirm("Bewertung löschen?")) return;
          startTransition(async () => {
            await rejectBewertung(id);
          });
        }}
        className="flex items-center gap-1.5 text-xs font-600 text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      >
        <Trash2 className="w-3 h-3" />
        Ablehnen
      </button>
    </div>
  );
}
