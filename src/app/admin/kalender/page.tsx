import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00–20:00
const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default async function AdminKalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekOffset = parseInt(week ?? "0");

  const now = new Date();
  const monday = getMonday(now, weekOffset);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  sunday.setHours(23, 59, 59, 999);

  const supabase = await createClient();

  // Neues Schema: bestätigte Termine + offene Terminanfragen
  const [{ data: appointments }, { data: requests }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, start_at, end_at, status, profiles(vorname, nachname)")
      .in("status", ["booked", "completed"])
      .gte("start_at", monday.toISOString())
      .lte("start_at", sunday.toISOString())
      .order("start_at", { ascending: true }),
    supabase
      .from("booking_requests")
      .select("id, desired_start, profiles(vorname, nachname)")
      .eq("status", "open")
      .gte("desired_start", monday.toISOString())
      .lte("desired_start", sunday.toISOString()),
  ]);

  type Eintrag = {
    id: string;
    beginn: string;
    ende: string;
    status: string;
    schueler: { vorname: string; nachname: string } | null;
  };

  const eintraege: Eintrag[] = [
    ...((appointments ?? []).map((a) => ({
      id: a.id,
      beginn: a.start_at,
      ende: a.end_at,
      status: a.status,
      schueler: (a.profiles as unknown) as { vorname: string; nachname: string } | null,
    }))),
    ...((requests ?? []).map((r) => ({
      id: r.id,
      beginn: r.desired_start,
      ende: new Date(new Date(r.desired_start).getTime() + 45 * 60000).toISOString(),
      status: "angefragt",
      schueler: (r.profiles as unknown) as { vorname: string; nachname: string } | null,
    }))),
  ];

  const weekLabel = `${monday.toLocaleDateString("de-CH", {
    day: "numeric",
    month: "long",
  })} – ${sunday.toLocaleDateString("de-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;

  // Group entries by day (0=Mon, ..., 6=Sun)
  const terminsByDay: Map<number, Eintrag[]> = new Map();
  for (let d = 0; d < 7; d++) terminsByDay.set(d, []);

  for (const t of eintraege) {
    const date = new Date(t.beginn);
    const dow = date.getDay(); // 0=Sun
    const dayIndex = dow === 0 ? 6 : dow - 1; // 0=Mon
    terminsByDay.get(dayIndex)?.push(t);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-800 text-[#3730A3]">Kalender</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/kalender?week=${weekOffset - 1}`}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200 bg-white"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <span className="text-sm font-500 text-gray-700 min-w-[200px] text-center">
            {weekLabel}
          </span>
          <Link
            href={`/admin/kalender?week=${weekOffset + 1}`}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200 bg-white"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Header row */}
            <div className="grid grid-cols-8 border-b border-gray-100">
              <div className="py-3 px-3 text-xs font-600 text-gray-400" />
              {DAYS.map((day, di) => {
                const date = new Date(monday.getTime() + di * 86400000);
                const isToday =
                  date.toDateString() === now.toDateString();
                return (
                  <div
                    key={day}
                    className={`py-3 px-2 text-center border-l border-gray-100 ${
                      isToday ? "bg-[#3730A3]/5" : ""
                    }`}
                  >
                    <p className={`text-xs font-600 uppercase tracking-wide ${isToday ? "text-[#3730A3]" : "text-gray-400"}`}>
                      {day}
                    </p>
                    <p className={`text-sm font-700 mt-0.5 ${isToday ? "text-[#3730A3]" : "text-gray-700"}`}>
                      {date.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Hour rows */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-8 border-b border-gray-50 min-h-[52px]"
              >
                <div className="py-2 px-3 text-xs font-500 text-gray-400 flex items-start pt-2.5">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {DAYS.map((_, di) => {
                  const dayTermine = terminsByDay.get(di) ?? [];
                  const thisHourTermine = dayTermine.filter((t) => {
                    const h = new Date(t.beginn).getHours();
                    return h === hour;
                  });
                  const isToday =
                    new Date(monday.getTime() + di * 86400000).toDateString() ===
                    now.toDateString();

                  return (
                    <div
                      key={di}
                      className={`border-l border-gray-100 p-1 ${isToday ? "bg-[#3730A3]/5" : ""}`}
                    >
                      {thisHourTermine.map((t) => {
                        const s = (t.schueler as unknown) as
                          | { vorname: string; nachname: string }
                          | null;
                        const startTime = new Date(t.beginn).toLocaleTimeString(
                          "de-CH",
                          { hour: "2-digit", minute: "2-digit" }
                        );
                        const endTime = new Date(t.ende).toLocaleTimeString(
                          "de-CH",
                          { hour: "2-digit", minute: "2-digit" }
                        );
                        return (
                          <div
                            key={t.id}
                            className={`rounded-lg px-2 py-1.5 text-xs font-500 leading-tight ${
                              t.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : t.status === "angefragt"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-[#3730A3]/10 text-[#3730A3]"
                            }`}
                          >
                            <p className="font-600 truncate">
                              {s ? `${s.vorname} ${s.nachname}` : "—"}
                            </p>
                            <p className="opacity-70">
                              {startTime}–{endTime}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getMonday(date: Date, offset: number): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}
