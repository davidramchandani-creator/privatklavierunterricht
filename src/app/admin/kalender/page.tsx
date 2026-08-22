import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatTime, zurichDateKey } from "@/lib/utils";
import KalenderView, { type DayVM, type EntryVM } from "./_components/KalenderView";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default async function AdminKalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const monthOffset = parseInt(month ?? "0");

  const now = new Date();
  // Erster Tag des Zielmonats (lokale Mitternacht).
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const targetMonth = firstOfMonth.getMonth();
  const lastOfMonth = new Date(firstOfMonth.getFullYear(), targetMonth + 1, 0);

  // Gitter beginnt am Montag der Woche des Monatsersten und endet am Sonntag
  // der Woche des Monatsletzten → immer volle Wochen.
  const gridStart = mondayOf(firstOfMonth);
  const gridEnd = new Date(mondayOf(lastOfMonth).getTime() + 6 * 86400000);
  gridEnd.setHours(23, 59, 59, 999);

  const supabase = await createClient();

  // Bestätigte Termine + offene Terminanfragen für den sichtbaren Gitter-Bereich.
  const [{ data: appointments }, { data: requests }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, start_at, end_at, status, profiles(vorname, nachname)")
      .in("status", ["booked", "completed"])
      .gte("start_at", gridStart.toISOString())
      .lte("start_at", gridEnd.toISOString())
      .order("start_at", { ascending: true }),
    supabase
      .from("booking_requests")
      .select("id, desired_start, profiles(vorname, nachname)")
      .eq("status", "open")
      .gte("desired_start", gridStart.toISOString())
      .lte("desired_start", gridEnd.toISOString()),
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

  const monthLabel = firstOfMonth.toLocaleDateString("de-CH", {
    timeZone: "Europe/Zurich",
    month: "long",
    year: "numeric",
  });

  const todayKey = zurichDateKey(now);
  const targetMonthKey = `${firstOfMonth.getFullYear()}-${String(targetMonth + 1).padStart(2, "0")}`;

  // Alle Gitter-Zellen (Mo … So, volle Wochen).
  const dayCount = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) + 1;
  const cellDates = Array.from({ length: dayCount }, (_, i) =>
    new Date(gridStart.getTime() + i * 86400000)
  );

  const entryVM = (t: Eintrag): EntryVM => ({
    id: t.id,
    name: t.schueler ? `${t.schueler.vorname} ${t.schueler.nachname}` : "—",
    status: t.status,
    timeRange: `${formatTime(t.beginn)}–${formatTime(t.ende)}`,
    dateShort: new Date(t.beginn).toLocaleDateString("de-CH", {
      timeZone: "Europe/Zurich",
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    beginn: t.beginn,
  });

  const days: DayVM[] = cellDates.map((date) => {
    const key = zurichDateKey(date);
    const entries = eintraege
      .filter((t) => zurichDateKey(t.beginn) === key)
      .sort((a, b) => new Date(a.beginn).getTime() - new Date(b.beginn).getTime())
      .map(entryVM);
    return {
      key,
      dayNum: Number(key.slice(8, 10)),
      isToday: key === todayKey,
      isCurrentMonth: key.slice(0, 7) === targetMonthKey,
      entries,
    };
  });

  // Agenda: alle Termine des Zielmonats, chronologisch.
  const agenda: EntryVM[] = eintraege
    .filter((t) => zurichDateKey(t.beginn).slice(0, 7) === targetMonthKey)
    .sort((a, b) => new Date(a.beginn).getTime() - new Date(b.beginn).getTime())
    .map(entryVM);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-800 text-[#1C244B]">Kalender</h1>
        <div className="flex items-center gap-1.5">
          {/* Kein Prefetch: Beide Pfeile würden sonst je einen ganzen
              Monat samt Terminen im Voraus rendern, nur weil sie sichtbar
              sind. */}
          <Link
            prefetch={false}
            href={`/admin/kalender?month=${monthOffset - 1}`}
            className="press p-2 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200 bg-white"
            aria-label="Vorheriger Monat"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </Link>
          <span className="text-sm font-700 text-[#1C244B] min-w-[130px] sm:min-w-[150px] text-center capitalize">
            {monthLabel}
          </span>
          <Link
            prefetch={false}
            href={`/admin/kalender?month=${monthOffset + 1}`}
            className="press p-2 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200 bg-white"
            aria-label="Nächster Monat"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </Link>
        </div>
      </div>

      <KalenderView days={days} weekdays={WEEKDAYS} agenda={agenda} />
    </div>
  );
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
