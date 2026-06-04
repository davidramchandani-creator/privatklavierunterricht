"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { bulkDeleteProcessedRequests } from "../../actions";

export default function BulkDeleteButton({ count }: { count: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  if (count === 0) return null;

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 border border-dashed border-gray-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Papierkorb leeren ({count})
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
      <span className="text-xs text-red-700">Alle {count} erledigten Einträge löschen?</span>
      <button
        onClick={() => {
          startTransition(async () => {
            await bulkDeleteProcessedRequests();
            router.refresh();
          });
        }}
        disabled={isPending}
        className="text-xs font-700 text-red-600 hover:text-red-800 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-3 h-3 animate-spin inline" /> : "Löschen"}
      </button>
      <button
        onClick={() => setConfirm(false)}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Abbrechen
      </button>
    </div>
  );
}
