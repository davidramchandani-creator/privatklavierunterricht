import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatTime, zurichDateKey, zurichHour } from "@/lib/utils";

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
    timeZone: "Europe/Zurich",
    day: "numeric",
    month: "long",
  })} – ${sunday.toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;

  // Zürcher Kalenderdatum (YYYY-MM-DD) für jede Spalte Mo–So.
  const dayKeys = Array.from({ length: 7 }, (_, i) =>
    zurichDateKey(new Date(monday.getTime() + i * 86400000))
  );
  const todayKey = zurichDateKey(now);

  // Termine pro Tag bündeln – anhand des Zürcher Datums, nicht der Server-Zone.
  const terminsByDay: Map<number, Eintrag[]> = new Map();
  for (let d = 0; d < 7; d++) terminsByDay.set(d, []);

  for (const t of eintraege) {
    const di = dayKeys.indexOf(zurichDateKey(t.beginn));
    if (di >= 0) terminsByDay.get(di)?.push(t);
  }

  // Mobile agenda: all entries sorted by day
  const agendaEntries = [...eintraege].sort(
    (a, b) => new Date(a.beginn).getTime() - new Date(b.beginn).getTime()
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-800 text-[#1C244B]">Kalender</h1>
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

      {/* Desktop: week grid (hidden on mobile) */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Header row */}
            <div className="grid grid-cols-8 border-b border-gray-100">
              <div className="py-3 px-3 text-xs font-600 text-gray-400" />
              {DAYS.map((day, di) => {
                const isToday = dayKeys[di] === todayKey;
                const dayNum = Number(dayKeys[di].slice(8, 10));
                return (
                  <div
                    key={day}
                    className={`py-3 px-2 text-center border-l border-gray-100 ${
                      isToday ? "bg-[#1C244B]/5" : ""
                    }`}
                  >
                    <p className={`text-xs font-600 uppercase tracking-wide ${isToday ? "text-[#1C244B]" : "text-gray-400"}`}>
                      {day}
                    </p>
                    <p className={`text-sm font-700 mt-0.5 ${isToday ? "text-[#1C244B]" : "text-gray-700"}`}>
                      {dayNum}
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
                  const thisHourTermine = dayTermine.filter(
                    (t) => zurichHour(t.beginn) === hour
                  );
                  const isToday = dayKeys[di] === todayKey;

                  return (
                    <div
                      key={di}
                      className={`border-l border-gray-100 p-1 ${isToday ? "bg-[#1C244B]/5" : ""}`}
                    >
                      {thisHourTermine.map((t) => {
                        const s = (t.schueler as unknown) as
                          | { vorname: string; nachname: string }
                          | null;
                        const startTime = formatTime(t.beginn);
                        const endTime = formatTime(t.ende);
                        return (
                          <div
                            key={t.id}
                            className={`rounded-lg px-2 py-1.5 text-xs font-500 leading-tight ${
                              t.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : t.status === "angefragt"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-[#1C244B]/10 text-[#1C244B]"
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

      {/* Mobile: agenda list (hidden on desktop) */}
      <div className="md:hidden space-y-3">
        {agendaEntries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            Keine Termine diese Woche
          </div>
        ) : (
          agendaEntries.map((t) => {
            const s = t.schueler as { vorname: string; nachname: string } | null;
            const start = new Date(t.beginn);
            const end = new Date(t.ende);
            return (
              <div
                key={t.id}
                className={`bg-white rounded-2xl border p-4 space-y-1 ${
                  t.status === "completed"
                    ? "border-emerald-200"
                    : t.status === "angefragt"
                    ? "border-amber-200"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-700 text-gray-900 text-sm">
                    {s ? `${s.vorname} ${s.nachname}` : "—"}
                  </p>
                  <span
                    className={`text-xs font-600 px-2 py-0.5 rounded-full ${
                      t.status === "completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : t.status === "angefragt"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-[#1C244B]/10 text-[#1C244B]"
                    }`}
                  >
                    {t.status === "angefragt" ? "Anfrage" : t.status === "completed" ? "Abgehalten" : "Gebucht"}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {start.toLocaleDateString("de-CH", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                    timeZone: "Europe/Zurich",
                  })}{" "}
                  ·{" "}
                  {start.toLocaleTimeString("de-CH", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Zurich",
                  })}
                  –
                  {end.toLocaleTimeString("de-CH", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Zurich",
                  })}{" "}
                  Uhr
                </p>
              </div>
            );
          })
        )}
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
