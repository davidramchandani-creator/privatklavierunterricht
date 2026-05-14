import { createClient } from "@/lib/supabase/server";
import { Users, Calendar, CreditCard, Star } from "lucide-react";
import { formatCHF, formatDateTime } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  const [
    { count: activeStudents },
    { data: upcomingThisWeek },
    { data: openPayments },
    { count: pendingReviews },
    { data: nextLessons },
  ] = await Promise.all([
    supabase
      .from("schueler")
      .select("*", { count: "exact", head: true })
      .eq("aktiv", true),
    supabase
      .from("termine")
      .select("id")
      .neq("status", "storniert")
      .gte("beginn", weekStart.toISOString())
      .lt("beginn", weekEnd.toISOString()),
    supabase
      .from("zahlungen")
      .select("betrag")
      .eq("status", "offen"),
    supabase
      .from("bewertungen")
      .select("*", { count: "exact", head: true })
      .eq("anzeigen", false),
    supabase
      .from("termine")
      .select("id, beginn, ende, status, schueler(vorname, nachname)")
      .neq("status", "storniert")
      .gte("beginn", now.toISOString())
      .order("beginn", { ascending: true })
      .limit(10),
  ]);

  const openPaymentsTotal = openPayments?.reduce(
    (sum, z) => sum + (z.betrag ?? 0),
    0
  ) ?? 0;

  const statusLabels: Record<string, string> = {
    bestaetigt: "Bestätigt",
    abgeschlossen: "Abgeschlossen",
    storniert: "Storniert",
  };
  const statusColors: Record<string, string> = {
    bestaetigt: "bg-blue-50 text-blue-700",
    abgeschlossen: "bg-emerald-50 text-emerald-700",
    storniert: "bg-red-50 text-red-600",
  };

  const stats = [
    {
      label: "Aktive Schüler",
      value: activeStudents ?? 0,
      icon: Users,
      color: "bg-[#3730A3]/10 text-[#3730A3]",
    },
    {
      label: "Lektionen diese Woche",
      value: upcomingThisWeek?.length ?? 0,
      icon: Calendar,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Offene Zahlungen",
      value: `${openPayments?.length ?? 0} · ${formatCHF(openPaymentsTotal)}`,
      icon: CreditCard,
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: "Neue Bewertungen",
      value: pendingReviews ?? 0,
      icon: Star,
      color: "bg-purple-50 text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-800 text-[#3730A3]">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-800 text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Upcoming lessons */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#3730A3] mb-4">
          Nächste Lektionen
        </h2>

        {!nextLessons || nextLessons.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Keine bevorstehenden Lektionen</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">
                    Schüler
                  </th>
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">
                    Datum & Zeit
                  </th>
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {nextLessons.map((t) => {
                  const s = (t.schueler as unknown) as { vorname: string; nachname: string } | null;
                  return (
                    <tr key={t.id}>
                      <td className="py-3 text-sm font-500 text-gray-900">
                        {s ? `${s.vorname} ${s.nachname}` : "—"}
                      </td>
                      <td className="py-3 text-sm text-gray-600">
                        {formatDateTime(t.beginn)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-xs font-500 px-2.5 py-0.5 rounded-full ${
                            statusColors[t.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {statusLabels[t.status] ?? t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
