import { createAdminClient } from "@/lib/supabase/server";
import { pricePerPersonFor } from "@/lib/group-courses";
import type { GroupCourse } from "@/lib/group-courses";
import Link from "next/link";
import { UsersRound, Plus, ChevronRight } from "lucide-react";
import KursForm from "./_components/KursForm";

export default async function GruppenkursePage() {
  const admin = await createAdminClient();

  const [{ data: courses }, { data: sessions }] = await Promise.all([
    admin.from("group_courses").select("*").order("title"),
    admin
      .from("group_sessions")
      .select("id, course_id, start_at, status")
      .in("status", ["open", "full"])
      .gte("start_at", new Date().toISOString()),
  ]);

  // Teilnehmerzahl je aktiver Session.
  const sessionIds = (sessions ?? []).map((s) => s.id);
  const countBySession = new Map<string, number>();
  if (sessionIds.length) {
    const { data: appts } = await admin
      .from("appointments")
      .select("group_session_id")
      .in("group_session_id", sessionIds)
      .in("status", ["booked", "completed"]);
    for (const a of appts ?? []) {
      const sid = a.group_session_id as string;
      countBySession.set(sid, (countBySession.get(sid) ?? 0) + 1);
    }
  }

  const activeCourses = (courses ?? []).filter((c) => c.status === "active") as GroupCourse[];
  const archivedCourses = (courses ?? []).filter((c) => c.status === "archived") as GroupCourse[];

  const sessionsForCourse = (courseId: string) =>
    (sessions ?? []).filter((s) => s.course_id === courseId);

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-800 text-[#1C244B]">Gruppenkurse</h1>

      {/* Neuer Kurs */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Neuen Kurs erstellen
        </h2>
        <KursForm />
      </div>

      {/* Aktive Kurse */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">Aktive Kurse</h2>
        {activeCourses.length === 0 ? (
          <p className="text-sm text-gray-400">Keine aktiven Kurse.</p>
        ) : (
          <div className="space-y-3">
            {activeCourses.map((course) => {
              const courseSessions = sessionsForCourse(course.id);
              const minPrice = pricePerPersonFor(course, 1);
              return (
                <Link
                  key={course.id}
                  href={`/admin/gruppenkurse/${course.id}`}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#1C244B]/20 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <UsersRound className="w-4.5 h-4.5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-600 text-gray-900 text-sm">{course.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Max. {course.max_participants} Pers. · ab CHF {minPrice}.–/Pers.
                      </p>
                      <p className="text-xs text-gray-400">
                        {courseSessions.length} offene Session{courseSessions.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#1C244B] transition-colors" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Archivierte Kurse */}
      {archivedCourses.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-lg font-700 text-gray-400 mb-4">Archivierte Kurse</h2>
          <div className="space-y-2">
            {archivedCourses.map((course) => (
              <Link
                key={course.id}
                href={`/admin/gruppenkurse/${course.id}`}
                className="flex items-center justify-between gap-4 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors opacity-60"
              >
                <p className="text-sm text-gray-600">{course.title}</p>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
