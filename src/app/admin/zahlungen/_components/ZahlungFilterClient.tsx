"use client";

import { useTransition } from "react";
import { updateZahlungStatus } from "../../actions";
import { Loader2 } from "lucide-react";

export default function ZahlungFilterClient({ zahlungId }: { zahlungId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await updateZahlungStatus(zahlungId, "bezahlt");
        })
      }
      className="text-xs font-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
    >
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin inline" />
      ) : (
        "Als bezahlt"
      )}
    </button>
  );
}
