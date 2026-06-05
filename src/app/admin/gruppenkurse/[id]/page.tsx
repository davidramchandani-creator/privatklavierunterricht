import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Users, Clock } from "lucide-react";
import type { GroupCourse } from "@/lib/group-courses";
import { pricePerPersonFor } from "@/lib/group-courses";
import KursForm from "../_components/KursForm";
import { CancelSessionButton, RemoveParticipantButton } from "./_components/SessionActions";
import { ArchiveButton } from "./_components/ArchiveButton";
import SessionPlanForm from "./_components/SessionPlanForm";

export default async function GruppenkurseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await createAdminClient();

  const { data: course } = await admin
    .from("group_courses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!course) notFound();

  const c = course as GroupCourse;

  // Sessionen + Teilnehmer laden.
  const { data: sessions } = await admin
    .from("group_sessions")
    .select("id, start_at, end_at, status")
    .eq("course_id", id)
    .order("start_at", { ascending: false })
    .limit(50);

  const sessionIds = (sessions ?? []).map((s) => s.id);
  let apptsBySession = new Map<string, { id: string; student_id: string; vorname: string; nachname: string }[]>();

  if (sessionIds.length) {
    const { data: appts } = await admin
      .from("appointments")
      .select("id, group_session_id, student_id, profiles(vorname, nachname)")
      .in("group_session_id", sessionIds)
      .in("status", ["booked", "completed"]);

    for (const a of appts ?? []) {
      const sid = a.group_session_id as string;
      if (!apptsBySession.has(sid)) apptsBySession.set(sid, []);
      const profiles = a.profiles as { vorname: string; nachname: string }[] | { vorname: string; nachname: string } | null;
      const p = Array.isArray(profiles) ? profiles[0] ?? null : profiles;
      apptsBySession.get(sid)!.push({
        id: a.id,
        student_id: a.student_id,
        vorname: p?.vorname ?? "—",
        nachname: p?.nachname ?? "",
      });
    }
  }

  const tiers = c.price_tiers as Record<string, number>;
  const tierList = Object.entries(tiers)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([k, v]) => `${k} Pers.: CHF ${v}.–`);

  const activeSessions = (sessions ?? []).filter((s) =>
    ["open", "full"].includes(s.status)
  );
  const pastSessions = (sessions ?? []).filter(
    (s) => !["open", "full"].includes(s.status)
  );

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("de-CH", {
      timeZone: "Europe/Zurich",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("de-CH", {
      timeZone: "Europe/Zurich",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/gruppenkurse"
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-800 text-[#1C244B] flex-1">{c.title}</h1>
        {c.status === "active" && <ArchiveButton courseId={c.id} />}
        {c.status === "archived" && (
          <span className="text-xs font-600 text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg">
            Archiviert
          </span>
        )}
      </div>

      {/* Kurs bearbeiten */}
      {c.status === "active" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-lg font-700 text-[#1C244B] mb-4">Kurs bearbeiten</h2>
          <KursForm
            course={{
              id: c.id,
              title: c.title,
              description: c.description,
              max_participants: c.max_participants,
              long_duration_from: c.long_duration_from,
              short_minutes: c.short_minutes,
              long_minutes: c.long_minutes,
              price_tiers: tiers,
            }}
          />
        </div>
      )}

      {/* Preis-Übersicht */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-base font-700 text-[#1C244B] mb-3">Preis-Tiers</h2>
        <div className="flex flex-wrap gap-2">
          {tierList.map((t) => (
            <span
              key={t}
              className="text-xs font-500 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg"
            >
              {t}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Ab {c.long_duration_from} Pers. → {c.long_minutes} Min. (sonst {c.short_minutes} Min.)
        </p>
      </div>

      {/* Termine planen */}
      {c.status === "active" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-lg font-700 text-[#1C244B] mb-4">Termine planen</h2>
          <SessionPlanForm courseId={c.id} />
        </div>
      )}

      {/* Aktive Sessionen */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">
          Aktive Sessionen ({activeSessions.length})
        </h2>
        {activeSessions.length === 0 ? (
          <p className="text-sm text-gray-400">Keine aktiven Sessionen.</p>
        ) : (
          <div className="space-y-4">
            {activeSessions.map((s) => {
              const participants = apptsBySession.get(s.id) ?? [];
              const count = participants.length;
              const price = pricePerPersonFor(c, count);
              return (
                <div key={s.id} className="border border-gray-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-600 text-gray-900 text-sm">{fmtDate(s.start_at)}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {fmtTime(s.start_at)} – {fmtTime(s.end_at)} Uhr
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {count}/{c.max_participants} Teilnehmer · CHF {price}.–/Pers. ·{" "}
                        <span
                          className={`font-600 ${
                            s.status === "full" ? "text-orange-500" : "text-emerald-600"
                          }`}
                        >
                          {s.status === "full" ? "Voll" : "Offen"}
                        </span>
                      </p>
                    </div>
                    <CancelSessionButton sessionId={s.id} />
                  </div>

                  {participants.length > 0 && (
                    <div className="space-y-1.5 pl-2 border-l-2 border-gray-100">
                      {participants.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Users className="w-3 h-3 text-gray-400" />
                            <Link
                              href={`/admin/schueler/${p.student_id}`}
                              className="text-xs text-[#1C244B] hover:underline font-500"
                            >
                              {p.vorname} {p.nachname}
                            </Link>
                          </div>
                          <RemoveParticipantButton appointmentId={p.id} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Vergangene Sessionen */}
      {pastSessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-base font-700 text-gray-400 mb-3">
            Abgeschlossene / Abgesagte Sessionen ({pastSessions.length})
          </h2>
          <div className="space-y-2">
            {pastSessions.map((s) => {
              const participants = apptsBySession.get(s.id) ?? [];
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="text-xs text-gray-600">
                      {fmtDate(s.start_at)} {fmtTime(s.start_at)}–{fmtTime(s.end_at)} Uhr
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {participants.length} Teilnehmer ·{" "}
                      <span
                        className={
                          s.status === "cancelled" ? "text-red-500" : "text-gray-400"
                        }
                      >
                        {s.status === "cancelled"
                          ? "Abgesagt"
                          : s.status === "completed"
                          ? "Abgeschlossen"
                          : s.status}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
