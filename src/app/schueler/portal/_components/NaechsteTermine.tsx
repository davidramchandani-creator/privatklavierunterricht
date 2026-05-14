"use client";

import { useState, useTransition } from "react";
import { Calendar, Clock, X, Download } from "lucide-react";
import { isWithin24Hours } from "@/lib/utils";
import { storniereTermin } from "../actions";

type Termin = {
  id: string;
  beginn: string;
  ende: string;
  status: string;
  notiz: string | null;
};

export default function NaechsteTermine({
  termine,
  schueler_id,
}: {
  termine: Termin[];
  schueler_id: string;
}) {
  if (termine.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
        <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Keine kommenden Lektionen</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {termine.map((t) => (
        <TerminRow key={t.id} termin={t} schueler_id={schueler_id} />
      ))}
    </div>
  );
}

function TerminRow({ termin, schueler_id }: { termin: Termin; schueler_id: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const beginn = new Date(termin.beginn);
  const ende = new Date(termin.ende);
  const within24h = isWithin24Hours(beginn);

  const day = beginn.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });
  const timeFrom = beginn.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  const timeTo = ende.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });

  function handleStornieren() {
    if (within24h) {
      setError("Lektionen können nur bis 24 Stunden vorher abgesagt werden.");
      return;
    }
    startTransition(async () => {
      const result = await storniereTermin(termin.id, schueler_id);
      if (result?.error) setError(result.error);
      else setCancelled(true);
    });
  }

  function downloadIcs() {
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Privatklavierunterricht//DE",
      "BEGIN:VEVENT",
      `DTSTART:${fmt(beginn)}`,
      `DTEND:${fmt(ende)}`,
      "SUMMARY:Klavierlektion bei David",
      "DESCRIPTION:Deine Klavierstunde",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lektion-${beginn.toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (cancelled) {
    return (
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 text-center text-sm text-gray-400">
        Lektion abgesagt
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1C244B]/8 flex flex-col items-center justify-center flex-shrink-0 text-[#1C244B]">
            <span className="text-xs font-700 leading-none">{beginn.getDate()}</span>
            <span className="text-[10px] leading-none opacity-70">
              {beginn.toLocaleDateString("de-CH", { month: "short" })}
            </span>
          </div>
          <div>
            <p className="font-600 text-gray-900 text-sm">{day}</p>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeFrom} – {timeTo} Uhr
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={downloadIcs}
            className="p-1.5 text-gray-400 hover:text-[#1C244B] rounded-lg hover:bg-gray-100 transition-colors"
            title="Zum Kalender hinzufügen"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleStornieren}
            disabled={isPending || within24h}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={within24h ? "Absage weniger als 24h vorher nicht möglich" : "Lektion absagen"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {within24h && (
        <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg px-3 py-1.5">
          Absage weniger als 24h vorher nicht mehr möglich
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-1.5">{error}</p>
      )}
    </div>
  );
}
