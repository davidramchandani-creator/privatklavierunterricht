"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { acceptBookingRequest, rejectBookingRequest } from "../../actions";
import { StatusBadge } from "@/components/ui/status-badge";

type BookingRequest = {
  id: string;
  desired_start: string;
  status: string;
  calculated_price: number | null;
  notes: string | null;
  erstellt_am: string;
  profiles: { vorname: string; nachname: string; email: string } | null;
};

function SlotRow({ req }: { req: BookingRequest }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptBookingRequest(req.id);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleReject() {
    const reason = prompt("Optionaler Ablehnungsgrund:") ?? undefined;
    setError(null);
    startTransition(async () => {
      const result = await rejectBookingRequest(req.id, reason);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-0 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <CalendarClock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="text-sm font-500 text-[#1C244B]">
          {formatDateTime(req.desired_start)} Uhr
        </span>
        {req.status !== "open" && (
          <StatusBadge kind="request" status={req.status} />
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {error && (
          <span className="text-xs text-red-600 bg-red-50 rounded px-2 py-0.5">{error}</span>
        )}
        {req.status === "open" && (
          <>
            <button
              onClick={handleAccept}
              disabled={isPending}
              className="flex items-center gap-1 text-xs font-600 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Annehmen
            </button>
            <button
              onClick={handleReject}
              disabled={isPending}
              className="flex items-center gap-1 text-xs font-600 text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-3 h-3" />
              Ablehnen
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function GruppenAnfrageCard({
  groupId,
  requests,
}: {
  groupId: string;
  requests: BookingRequest[];
}) {
  const [expanded, setExpanded] = useState(true);

  const sorted = [...requests].sort((a, b) =>
    a.desired_start.localeCompare(b.desired_start)
  );

  const name = requests[0]?.profiles
    ? `${requests[0].profiles.vorname} ${requests[0].profiles.nachname}`
    : "Unbekannt";

  const openCount = requests.filter((r) => r.status === "open").length;
  const totalCount = requests.length;

  const firstDate = sorted[0]?.desired_start;
  const lastDate = sorted[sorted.length - 1]?.desired_start;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-700 text-gray-900">{name}</p>
            <span className="text-xs font-500 px-2 py-0.5 rounded-full bg-[#1C244B]/10 text-[#1C244B]">
              {totalCount} Termine
            </span>
            {openCount > 0 && (
              <span className="text-xs font-500 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {openCount} offen
              </span>
            )}
          </div>
          {firstDate && lastDate && firstDate !== lastDate && (
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDateTime(firstDate)}, {formatDateTime(lastDate)}
            </p>
          )}
          {firstDate && firstDate === lastDate && (
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDateTime(firstDate)} Uhr
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
        >
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5" /> Einklappen</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" /> Ausklappen</>
          )}
        </button>
      </div>

      {expanded && (
        <div className="bg-gray-50 rounded-xl px-3 py-1">
          {sorted.map((req) => (
            <SlotRow key={req.id} req={req} />
          ))}
        </div>
      )}

      {requests[0]?.notes && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
          {requests[0].notes}
        </p>
      )}
    </div>
  );
}
