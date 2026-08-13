"use client";

import { useState, useTransition } from "react";
import { Users, Loader2, UserPlus, CheckCircle2 } from "lucide-react";
import {
  joinGroupSessionAction,
  type GroupCourseVM,
} from "../actions";

export default function Gruppenkurse({ courses }: { courses: GroupCourseVM[] }) {
  if (courses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
        <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Aktuell keine Gruppenkurse verfügbar</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {courses.map((course) => (
        <KursCard key={course.id} course={course} />
      ))}
    </div>
  );
}

function KursCard({ course }: { course: GroupCourseVM }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-700 text-gray-900 text-sm leading-snug">{course.title}</h3>
              {course.description && (
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{course.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-[11px] text-gray-500">
                  Max. {course.max_participants} Person{course.max_participants !== 1 ? "en" : ""}
                </span>
                <span className="text-[11px] text-gray-300">·</span>
                <span className="text-[11px] text-gray-500">
                  Ab {course.long_duration_from} Pers. → {course.long_minutes} Min.
                </span>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Preis/Lektion</p>
            <p className="text-sm font-700 text-[#1C244B]">ab CHF {course.min_price_per_person}.–/Pers.</p>
          </div>
        </div>
      </div>

      {/* Open sessions */}
      <div className="px-5 py-4 space-y-2.5">
        {course.open_sessions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">
            Aktuell keine Termine geplant, schau bald wieder vorbei.
          </p>
        ) : (
          course.open_sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))
        )}
      </div>
    </div>
  );
}

function SessionRow({
  session,
}: {
  session: GroupCourseVM["open_sessions"][number];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  const start = new Date(session.start_at);
  const end = new Date(session.end_at);
  const dateLabel = start.toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeLabel = `${start.toLocaleTimeString("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  })} – ${end.toLocaleTimeString("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  })} Uhr`;

  const freeSeats = session.free_seats;

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      const result = await joinGroupSessionAction(session.id);
      if (result && "error" in result) setError(result.error ?? null);
      else setJoined(true);
    });
  }

  if (joined) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-xs text-emerald-700 font-500">
        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        Du bist dieser Session beigetreten!
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
      <div>
        <p className="text-xs font-600 text-gray-900">{dateLabel}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{timeLabel}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-gray-500">
            {freeSeats > 0 ? `${freeSeats} Platz${freeSeats !== 1 ? "ätze" : ""} frei` : "Voll"}
          </span>
          <span className="text-[11px] text-gray-300">·</span>
          <span className="text-[11px] font-600 text-[#1C244B]">
            CHF {session.join_price}.–/Person
          </span>
        </div>
        {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
      </div>
      <div className="flex-shrink-0">
        {session.is_mine ? (
          <span className="text-[11px] font-600 text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
            Dabei
          </span>
        ) : session.status === "full" || freeSeats <= 0 ? (
          <span className="text-[11px] text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">
            Voll
          </span>
        ) : (
          <button
            onClick={handleJoin}
            disabled={isPending}
            className="text-[11px] font-600 text-white bg-[#1C244B] px-3 py-1.5 rounded-lg hover:bg-[#151c3d] transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <UserPlus className="w-3 h-3" />
            )}
            Beitreten
          </button>
        )}
      </div>
    </div>
  );
}
