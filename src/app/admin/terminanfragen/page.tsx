import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { CalendarClock, Repeat, Layers, CalendarSync, ArrowRight } from "lucide-react";
import TerminanfrageActions from "./_components/TerminanfrageActions";
import VerschiebungActions from "./_components/VerschiebungActions";
import { StatusBadge } from "@/components/ui/status-badge";

type BookingRequest = {
  id: string;
  student_id: string;
  desired_start: string;
  status: string;
  lessons_count: number;
  interval_days: number;
  calculated_price: number | null;
  notes: string | null;
  erstellt_am: string;
  processed_at: string | null;
  profiles: { vorname: string; nachname: string; email: string } | null;
};

type RescheduleRequest = {
  id: string;
  student_id: string;
  original_start: string;
  proposed_start: string;
  reason: string | null;
  status: string;
  erstellt_am: string;
  profiles: { vorname: string; nachname: string } | null;
};

export default async function AdminTerminanfragenPage() {
  const supabase = await createClient();

  const [{ data: requests }, { data: reschedules }] = await Promise.all([
    supabase
      .from("booking_requests")
      .select(
        "id, student_id, desired_start, status, lessons_count, interval_days, calculated_price, notes, erstellt_am, processed_at, profiles(vorname, nachname, email)"
      )
      .order("erstellt_am", { ascending: false }),
    supabase
      .from("reschedule_requests")
      .select(
        "id, student_id, original_start, proposed_start, reason, status, erstellt_am, profiles(vorname, nachname)"
      )
      .order("erstellt_am", { ascending: false }),
  ]);

  const list = (requests ?? []) as unknown as BookingRequest[];
  const offen = list.filter((r) => r.status === "open");
  const erledigt = list.filter((r) => r.status !== "open");

  const rescheduleList = (reschedules ?? []) as unknown as RescheduleRequest[];
  const offeneVerschiebungen = rescheduleList.filter((r) => r.status === "open");

  const offenGesamt = offen.length + offeneVerschiebungen.length;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-800 text-[#1C244B]">Terminanfragen</h1>
        {offenGesamt > 0 && (
          <span className="bg-amber-100 text-amber-700 text-xs font-700 px-3 py-1 rounded-full">
            {offenGesamt} offen
          </span>
        )}
      </div>

      {list.length === 0 && offeneVerschiebungen.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400">
          <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Noch keine Terminanfragen</p>
        </div>
      )}

      {offeneVerschiebungen.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-600 text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <CalendarSync className="w-3.5 h-3.5" /> Verschiebungswünsche
          </h2>
          {offeneVerschiebungen.map((r) => (
            <RescheduleCard key={r.id} req={r} />
          ))}
        </section>
      )}

      {offen.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-600 text-gray-500 uppercase tracking-wide">
            Offen
          </h2>
          {offen.map((r) => (
            <RequestCard key={r.id} req={r} />
          ))}
        </section>
      )}

      {erledigt.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-600 text-gray-500 uppercase tracking-wide">
            Erledigt
          </h2>
          {erledigt.map((r) => (
            <RequestCard key={r.id} req={r} muted />
          ))}
        </section>
      )}
    </div>
  );
}

function RequestCard({ req, muted = false }: { req: BookingRequest; muted?: boolean }) {
  const name = req.profiles
    ? `${req.profiles.vorname} ${req.profiles.nachname}`
    : "Unbekannt";
  const isSeries = req.lessons_count > 1;

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-5 space-y-3 ${
        muted ? "border-gray-100 opacity-70" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-700 text-gray-900">{name}</p>
            <StatusBadge kind="request" status={req.status} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Angefragt am {formatDateTime(req.erstellt_am)}
          </p>
        </div>
        {req.status === "open" && (
          <TerminanfrageActions requestId={req.id} />
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2 text-[#1C244B] font-500">
          <CalendarClock className="w-3.5 h-3.5 flex-shrink-0" />
          {formatDateTime(req.desired_start)} Uhr
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Layers className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
          {isSeries ? `${req.lessons_count} Lektionen` : "Einzeltermin"}
        </div>
        {isSeries && (
          <div className="flex items-center gap-2 text-gray-600">
            <Repeat className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            {req.interval_days === 7 ? "Wöchentlich" : "Alle 2 Wochen"}
          </div>
        )}
        {req.calculated_price != null && (
          <div className="text-gray-600">
            Preis:{" "}
            <span className="font-600 text-gray-900">
              CHF {Number(req.calculated_price).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {req.notes && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
          {req.notes}
        </p>
      )}
    </div>
  );
}

function RescheduleCard({ req }: { req: RescheduleRequest }) {
  const name = req.profiles
    ? `${req.profiles.vorname} ${req.profiles.nachname}`
    : "Unbekannt";

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-700 text-gray-900">{name}</p>
            <span className="text-xs font-500 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Verschiebung
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Angefragt am {formatDateTime(req.erstellt_am)}
          </p>
        </div>
        <VerschiebungActions rescheduleId={req.id} />
      </div>

      <div className="flex items-center gap-3 text-sm flex-wrap bg-gray-50 rounded-xl px-3 py-2.5">
        <span className="text-gray-500 line-through">
          {formatDateTime(req.original_start)}
        </span>
        <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <span className="text-[#1C244B] font-600">
          {formatDateTime(req.proposed_start)} Uhr
        </span>
      </div>

      {req.reason && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
          {req.reason}
        </p>
      )}
    </div>
  );
}
