"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Calendar,
  Clock,
  X,
  Download,
  CalendarClock,
  Repeat,
  CalendarSync,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { isWithin24Hours } from "@/lib/utils";
import {
  cancelAppointment,
  withdrawBookingRequest,
  withdrawGroupBookingRequests,
  requestReschedule,
  withdrawReschedule,
  getVerfuegbareSlots,
  type AvailableSlot,
} from "../actions";

type Appointment = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
};

type BookingRequest = {
  id: string;
  desired_start: string;
  lessons_count: number;
  interval_days: number;
  status: string;
  group_id?: string | null;
};

type RescheduleRequest = {
  id: string;
  appointment_id: string;
  original_start: string;
  proposed_start: string;
  status: string;
};

export default function NaechsteTermine({
  appointments,
  requests,
  reschedules = [],
}: {
  appointments: Appointment[];
  requests: BookingRequest[];
  reschedules?: RescheduleRequest[];
}) {
  const offeneAnfragen = requests.filter((r) => r.status === "open");
  const offeneVerschiebungen = reschedules.filter((r) => r.status === "open");

  // Gruppe Anfragen: mit group_id → gebündelt; ohne → einzeln
  const grouped = new Map<string, BookingRequest[]>();
  const singles: BookingRequest[] = [];
  for (const r of offeneAnfragen) {
    if (r.group_id) {
      if (!grouped.has(r.group_id)) grouped.set(r.group_id, []);
      grouped.get(r.group_id)!.push(r);
    } else {
      singles.push(r);
    }
  }

  if (
    appointments.length === 0 &&
    offeneAnfragen.length === 0 &&
    offeneVerschiebungen.length === 0
  ) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
        <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Keine kommenden Lektionen</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Gruppenanfragen */}
      {Array.from(grouped.entries()).map(([groupId, reqs]) => (
        <GruppenAnfrageRow key={groupId} groupId={groupId} requests={reqs} />
      ))}
      {/* Einzelanfragen (legacy) */}
      {singles.map((r) => (
        <AnfrageRow key={r.id} request={r} />
      ))}
      {appointments.map((a) => (
        <TerminRow
          key={a.id}
          appointment={a}
          pendingReschedule={
            offeneVerschiebungen.find((v) => v.appointment_id === a.id) ?? null
          }
        />
      ))}
    </div>
  );
}

function GruppenAnfrageRow({
  groupId,
  requests,
}: {
  groupId: string;
  requests: BookingRequest[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [withdrawn, setWithdrawn] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const sorted = [...requests].sort((a, b) =>
    a.desired_start.localeCompare(b.desired_start)
  );

  function handleWithdraw() {
    startTransition(async () => {
      const result = await withdrawGroupBookingRequests(groupId);
      if (result?.error) setError(result.error);
      else setWithdrawn(true);
    });
  }

  if (withdrawn) {
    return (
      <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 text-center text-sm text-gray-400">
        Anfrage zurückgezogen
      </div>
    );
  }

  return (
    <div className="bg-amber-50/60 rounded-2xl border border-amber-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-600 text-gray-900 text-sm">
                {sorted.length} Lektionen angefragt
              </p>
              <span className="text-[10px] font-600 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                Angefragt
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {expanded ? "Termine ausblenden" : "Termine anzeigen"}
            </p>
          </div>
        </button>
        <button
          onClick={handleWithdraw}
          disabled={isPending}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
          title="Alle zurückziehen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="space-y-1.5 pl-11">
          {sorted.map((r) => {
            const start = new Date(r.desired_start);
            return (
              <div key={r.id} className="flex items-center gap-2 text-xs text-gray-700">
                <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                <span>
                  {start.toLocaleDateString("de-CH", {
                    timeZone: "Europe/Zurich",
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })},{" "}
                  {start.toLocaleTimeString("de-CH", {
                    timeZone: "Europe/Zurich",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  Uhr
                </span>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">{error}</p>
      )}
    </div>
  );
}

function AnfrageRow({ request }: { request: BookingRequest }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [withdrawn, setWithdrawn] = useState(false);

  const start = new Date(request.desired_start);
  const day = start.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const time = start.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  const isSeries = request.lessons_count > 1;

  function handleWithdraw() {
    startTransition(async () => {
      const result = await withdrawBookingRequest(request.id);
      if (result?.error) setError(result.error);
      else setWithdrawn(true);
    });
  }

  if (withdrawn) {
    return (
      <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 text-center text-sm text-gray-400">
        Anfrage zurückgezogen
      </div>
    );
  }

  return (
    <div className="bg-amber-50/60 rounded-2xl border border-amber-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-600 text-gray-900 text-sm">{day}</p>
              <span className="text-[10px] font-600 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                Angefragt
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {time} Uhr
              {isSeries && (
                <span className="flex items-center gap-1 ml-1">
                  <Repeat className="w-3 h-3" />
                  {request.lessons_count}×{" "}
                  {request.interval_days === 7 ? "wöchentlich" : "alle 2 Wochen"}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={handleWithdraw}
          disabled={isPending}
          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
          title="Anfrage zurückziehen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-1.5">{error}</p>
      )}
    </div>
  );
}

function TerminRow({
  appointment,
  pendingReschedule,
}: {
  appointment: Appointment;
  pendingReschedule: RescheduleRequest | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleSent, setRescheduleSent] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const beginn = new Date(appointment.start_at);
  const ende = new Date(appointment.end_at);
  const within24h = isWithin24Hours(beginn);

  const day = beginn.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeFrom = beginn.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  const timeTo = ende.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });

  function handleStornieren() {
    if (within24h) {
      setError("Lektionen können nur bis 24 Stunden vorher abgesagt werden.");
      return;
    }
    startTransition(async () => {
      const result = await cancelAppointment(appointment.id);
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
      <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 text-center text-sm text-gray-400">
        Lektion abgesagt
      </div>
    );
  }

  const hasPendingReschedule = !!pendingReschedule || rescheduleSent;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
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
          {!hasPendingReschedule && (
            <button
              onClick={() => {
                if (within24h) {
                  setError("Verschiebungen sind nur bis 24 Stunden vorher möglich.");
                  return;
                }
                setError(null);
                setRescheduleOpen((o) => !o);
              }}
              disabled={within24h}
              className="p-1.5 text-gray-400 hover:text-[#1C244B] rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={within24h ? "Verschieben weniger als 24h vorher nicht möglich" : "Termin verschieben"}
            >
              <CalendarSync className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              if (within24h) {
                setError("Lektionen können nur bis 24 Stunden vorher abgesagt werden.");
                return;
              }
              setError(null);
              setConfirmCancel(true);
            }}
            disabled={isPending || within24h}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={within24h ? "Absage weniger als 24h vorher nicht möglich" : "Lektion absagen"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {confirmCancel && (
        <div className="mt-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
          <p className="text-sm font-600 text-gray-900">Lektion wirklich absagen?</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Das kann nicht rückgängig gemacht werden. Du erhältst eine Bestätigung
            per E-Mail.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleStornieren}
              disabled={isPending}
              className="text-xs font-600 text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {isPending ? "Wird abgesagt …" : "Ja, absagen"}
            </button>
            <button
              onClick={() => setConfirmCancel(false)}
              disabled={isPending}
              className="text-xs font-500 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {hasPendingReschedule && (
        <PendingRescheduleBanner
          reschedule={pendingReschedule}
          onWithdrawn={() => {
            setRescheduleSent(false);
          }}
        />
      )}

      {rescheduleOpen && !hasPendingReschedule && (
        <ReschedulePicker
          appointmentId={appointment.id}
          onClose={() => setRescheduleOpen(false)}
          onSent={() => {
            setRescheduleOpen(false);
            setRescheduleSent(true);
          }}
        />
      )}

      {within24h && !hasPendingReschedule && (
        <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg px-3 py-1.5">
          Änderungen weniger als 24h vorher nicht mehr möglich
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-1.5">{error}</p>
      )}
    </div>
  );
}

function PendingRescheduleBanner({
  reschedule,
  onWithdrawn,
}: {
  reschedule: RescheduleRequest | null;
  onWithdrawn: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [withdrawn, setWithdrawn] = useState(false);

  if (withdrawn) {
    return (
      <p className="text-xs text-gray-400 mt-2 bg-gray-50 rounded-lg px-3 py-1.5">
        Verschiebung zurückgezogen
      </p>
    );
  }

  const proposed = reschedule ? new Date(reschedule.proposed_start) : null;
  const proposedLabel = proposed
    ? `${proposed.toLocaleDateString("de-CH", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })}, ${proposed.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })} Uhr`
    : null;

  function handleWithdraw() {
    if (!reschedule) return;
    startTransition(async () => {
      const result = await withdrawReschedule(reschedule.id);
      if (result?.error) setError(result.error);
      else {
        setWithdrawn(true);
        onWithdrawn();
      }
    });
  }

  return (
    <div className="mt-2 bg-amber-50/70 border border-amber-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
      <p className="text-xs text-amber-700 flex items-center gap-1.5">
        <CalendarSync className="w-3.5 h-3.5 flex-shrink-0" />
        Verschiebung angefragt
        {proposedLabel && (
          <span className="font-600">→ {proposedLabel}</span>
        )}
      </p>
      {reschedule && (
        <button
          onClick={handleWithdraw}
          disabled={isPending}
          className="text-[11px] text-amber-700 hover:text-red-600 font-600 disabled:opacity-40 flex-shrink-0"
        >
          {isPending ? "…" : "Zurückziehen"}
        </button>
      )}
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}

function ReschedulePicker({
  appointmentId,
  onClose,
  onSent,
}: {
  appointmentId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    startTransition(async () => {
      const result = await getVerfuegbareSlots(weekOffset);
      setSlots(result);
      setLoadingSlots(false);
    });
  }, [weekOffset]);

  const slotsByDay = new Map<string, AvailableSlot[]>();
  for (const slot of slots) {
    const dateStr = slot.beginn.split("T")[0];
    if (!slotsByDay.has(dateStr)) slotsByDay.set(dateStr, []);
    slotsByDay.get(dateStr)!.push(slot);
  }

  const monday = getMonday(weekOffset);
  const days: { dateStr: string; label: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday.getTime() + i * 86400000);
    days.push({
      dateStr: d.toISOString().split("T")[0],
      label: d.toLocaleDateString("de-CH", { weekday: "short" }),
    });
  }
  const friday = new Date(monday.getTime() + 4 * 86400000);
  const weekLabel = `${monday.toLocaleDateString("de-CH", {
    day: "numeric",
    month: "short",
  })} – ${friday.toLocaleDateString("de-CH", {
    day: "numeric",
    month: "short",
  })}`;

  function handleSubmit() {
    if (!selectedSlot) return;
    setError(null);
    startTransition(async () => {
      const result = await requestReschedule(appointmentId, selectedSlot.beginn);
      if (result?.error) setError(result.error);
      else onSent();
    });
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-600 text-gray-700">Neuen Zeitpunkt wählen</p>
        <button
          onClick={onClose}
          className="text-[11px] text-gray-400 hover:text-gray-600"
        >
          Abbrechen
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          disabled={weekOffset <= 0}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-500 text-gray-600">{weekLabel}</span>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loadingSlots ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-[#1C244B]" />
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <Calendar className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
          <p className="text-xs">Keine freien Slots diese Woche</p>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-1.5">
          {days.map((d) => {
            const daySlots = slotsByDay.get(d.dateStr) ?? [];
            return (
              <div key={d.dateStr} className="space-y-1">
                <p className="text-[10px] font-600 text-gray-400 text-center uppercase tracking-wide">
                  {d.label}
                </p>
                {daySlots.length === 0 ? (
                  <p className="text-[10px] text-gray-300 text-center mt-1">—</p>
                ) : (
                  daySlots.map((slot) => {
                    const isSelected = selectedSlot?.beginn === slot.beginn;
                    const time = new Date(slot.beginn).toLocaleTimeString("de-CH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <button
                        key={slot.beginn}
                        onClick={() => setSelectedSlot(isSelected ? null : slot)}
                        className={`w-full text-[11px] py-1.5 rounded-lg font-500 transition-colors ${
                          isSelected
                            ? "bg-[#1C244B] text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-[#1C244B]/10"
                        }`}
                      >
                        {time}
                      </button>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!selectedSlot || isPending || loadingSlots}
        className="w-full text-sm font-600 text-white bg-[#1C244B] rounded-xl py-2.5 hover:bg-[#151c3d] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
      >
        {isPending && !loadingSlots ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Wird gesendet…
          </>
        ) : selectedSlot ? (
          `Verschiebung anfragen – ${new Date(selectedSlot.beginn).toLocaleDateString(
            "de-CH",
            { weekday: "short", day: "numeric", month: "short" }
          )} ${new Date(selectedSlot.beginn).toLocaleTimeString("de-CH", {
            hour: "2-digit",
            minute: "2-digit",
          })} Uhr`
        ) : (
          "Zeitfenster wählen"
        )}
      </button>
    </div>
  );
}

function getMonday(weekOffset: number): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
