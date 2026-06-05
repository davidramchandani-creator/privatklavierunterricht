"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Repeat, Check, X } from "lucide-react";
import { acceptProposal, rejectProposal } from "@/app/schueler/portal/actions";

export type Proposal = {
  id: string;
  proposed_start: string;
  lessons_count: number;
  interval_days: number;
  status: string;
};

function fmt(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("de-CH", {
      timeZone: "Europe/Zurich",
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    time: d.toLocaleTimeString("de-CH", {
      timeZone: "Europe/Zurich",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function ProposalRow({ proposal }: { proposal: Proposal }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);

  const { day, time } = fmt(proposal.proposed_start);
  const isSeries = proposal.lessons_count > 1;

  function handle(action: "accept" | "reject") {
    setError(null);
    startTransition(async () => {
      const res =
        action === "accept"
          ? await acceptProposal(proposal.id)
          : await rejectProposal(proposal.id);
      if (res && "error" in res && res.error) setError(res.error);
      else setDone(action === "accept" ? "accepted" : "rejected");
    });
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center text-sm text-gray-400">
        {done === "accepted" ? "Vorschlag angenommen – Termin gebucht." : "Vorschlag abgelehnt."}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-navy-100 bg-navy-50/40 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-navy-100 flex items-center justify-center flex-shrink-0 text-navy-900">
          <CalendarClock className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-600 text-gray-900 text-sm">{day}</p>
            <span className="text-[10px] font-600 bg-navy-100 text-navy-900 px-1.5 py-0.5 rounded-full">
              Vorschlag
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {time} Uhr
            {isSeries && (
              <span className="inline-flex items-center gap-1 ml-1">
                <Repeat className="w-3 h-3" />
                {proposal.lessons_count}×{" "}
                {proposal.interval_days === 7 ? "wöchentlich" : "alle 2 Wochen"}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => handle("accept")}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 text-xs font-600 text-white bg-navy-900 hover:bg-navy-800 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          Annehmen
        </button>
        <button
          onClick={() => handle("reject")}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 text-xs font-500 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          Ablehnen
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-1.5">{error}</p>
      )}
    </div>
  );
}

export default function ProposalCard({ proposals }: { proposals: Proposal[] }) {
  if (!proposals || proposals.length === 0) return null;
  return (
    <div className="space-y-3">
      <p className="text-[13px] font-600 text-gray-400">
        Terminvorschläge von David
      </p>
      {proposals.map((p) => (
        <ProposalRow key={p.id} proposal={p} />
      ))}
    </div>
  );
}
