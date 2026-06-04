import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatTime, zurichDateKey, zurichHour } from "@/lib/utils";
import KalenderView, { type DayVM, type EntryVM } from "./_components/KalenderView";

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

  // View-Models serverseitig bauen → alle Zeitzonen-Logik bleibt zentral,
  // die Client-Komponente rendert nur fertige Strings.
  const entryVM = (t: Eintrag): EntryVM => ({
    id: t.id,
    name: t.schueler ? `${t.schueler.vorname} ${t.schueler.nachname}` : "—",
    status: t.status,
    hour: zurichHour(t.beginn),
    timeRange: `${formatTime(t.beginn)}–${formatTime(t.ende)}`,
    dateShort: new Date(t.beginn).toLocaleDateString("de-CH", {
      timeZone: "Europe/Zurich",
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
  });

  const days: DayVM[] = dayKeys.map((key, i) => {
    const entries = eintraege
      .filter((t) => zurichDateKey(t.beginn) === key)
      .sort((a, b) => new Date(a.beginn).getTime() - new Date(b.beginn).getTime())
      .map(entryVM);
    return {
      key,
      weekdayShort: DAYS[i],
      dayNum: Number(key.slice(8, 10)),
      isToday: key === todayKey,
      entries,
    };
  });

  const agenda: EntryVM[] = [...eintraege]
    .sort((a, b) => new Date(a.beginn).getTime() - new Date(b.beginn).getTime())
    .map(entryVM);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-800 text-[#1C244B]">Kalender</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/kalender?week=${weekOffset - 1}`}
            className="press p-2 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200 bg-white"
            aria-label="Vorherige Woche"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <span className="text-xs sm:text-sm font-500 text-gray-700 sm:min-w-[200px] text-center">
            {weekLabel}
          </span>
          <Link
            href={`/admin/kalender?week=${weekOffset + 1}`}
            className="press p-2 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200 bg-white"
            aria-label="Nächste Woche"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </Link>
        </div>
      </div>

      <KalenderView days={days} hours={HOURS} agenda={agenda} />
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
