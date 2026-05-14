"use client";

import { useTransition } from "react";
import { updateAnfrageStatus } from "../../actions";

export default function AnfrageActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  function setStatus(newStatus: string) {
    startTransition(async () => {
      await updateAnfrageStatus(id, newStatus);
    });
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {status === "neu" ? (
        <>
          <button
            onClick={() => setStatus("bearbeitet")}
            disabled={isPending}
            className="text-xs font-600 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            Bearbeitet
          </button>
          <button
            onClick={() => setStatus("abgesagt")}
            disabled={isPending}
            className="text-xs font-500 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
          >
            Absagen
          </button>
        </>
      ) : (
        <span
          className={`text-xs font-500 px-2.5 py-1 rounded-full ${
            status === "bearbeitet"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {status === "bearbeitet" ? "Bearbeitet" : "Abgesagt"}
        </span>
      )}
    </div>
  );
}
