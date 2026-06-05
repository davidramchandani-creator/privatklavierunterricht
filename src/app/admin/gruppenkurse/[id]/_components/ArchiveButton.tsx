"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Archive } from "lucide-react";
import { archiveGroupCourse } from "../../../actions";

export function ArchiveButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle() {
    if (!confirm("Kurs archivieren? Er wird nicht mehr angezeigt.")) return;
    setError(null);
    startTransition(async () => {
      const result = await archiveGroupCourse(courseId);
      if (result && "error" in result) setError(result.error ?? "Fehler");
      else router.push("/admin/gruppenkurse");
    });
  }

  return (
    <div>
      <button
        onClick={handle}
        disabled={isPending}
        className="flex items-center gap-1.5 text-xs font-500 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
        Archivieren
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
