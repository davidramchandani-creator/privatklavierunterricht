import { createAdminClient } from "@/lib/supabase/server";
import { ladeWochenbriefing } from "@/lib/briefing-server";
import {
  ladeOffeneNotizen,
  ladeVorschauFuer,
} from "@/lib/lektionsnotizen-server";
import { inhaltLabel } from "@/lib/lektionsnotizen";
import { Users, Calendar, CreditCard, Inbox, NotebookPen } from "lucide-react";
import { formatCHF, formatDateTime } from "@/lib/utils";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const supabase = await createAdminClient();

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
    { count: openBookingRequests },
    { data: nextLessons },
    briefing,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "student")
      .eq("aktiv", true)
      // Testschüler bleiben aussen vor: die Kennzahlen sollen die
      // Wirklichkeit zeigen, nicht den Testlauf.
      .eq("ist_test", false),
    supabase
      .from("appointments")
      .select("id")
      .in("status", ["booked", "completed"])
      .gte("start_at", weekStart.toISOString())
      .lt("start_at", weekEnd.toISOString()),
    supabase
      .from("invoices")
      .select("amount")
      .in("status", ["unpaid", "pending_confirmation"]),
    supabase
      .from("booking_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("appointments")
      .select(
        "id, student_id, start_at, end_at, status, profiles(vorname, nachname)"
      )
      .in("status", ["booked", "completed"])
      .gte("start_at", now.toISOString())
      .order("start_at", { ascending: true })
      .limit(10),
    ladeWochenbriefing(supabase, now),
  ]);

  // Der Stand vor der nächsten Stunde. Ohne ihn steht man vor der Tür und
  // erinnert sich nicht, was letztes Mal aufgegeben wurde — genau die Lücke,
  // die diese Vorschau schliesst.
  const naechsteIds = [
    ...new Set((nextLessons ?? []).map((t) => t.student_id as string)),
  ];
  const [vorschau, offeneNotizen] = await Promise.all([
    ladeVorschauFuer(supabase, naechsteIds),
    ladeOffeneNotizen(supabase, now),
  ]);

  const openPaymentsTotal = openPayments?.reduce(
    (sum, inv) => sum + Number(inv.amount ?? 0),
    0
  ) ?? 0;

  const statusLabels: Record<string, string> = {
    booked: "Bestätigt",
    completed: "Abgeschlossen",
    cancelled: "Storniert",
    no_show: "Nicht erschienen",
  };
  const statusColors: Record<string, string> = {
    booked: "bg-blue-50 text-blue-700",
    completed: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-red-50 text-red-600",
    no_show: "bg-gray-100 text-gray-600",
  };

  const stats = [
    {
      label: "Offene Terminanfragen",
      value: openBookingRequests ?? 0,
      icon: Inbox,
      color: "bg-amber-50 text-amber-600",
      href: "/admin/terminanfragen",
    },
    {
      label: "Aktive Schüler",
      value: activeStudents ?? 0,
      icon: Users,
      color: "bg-[#1C244B]/10 text-[#1C244B]",
      href: "/admin/schueler",
    },
    {
      label: "Lektionen diese Woche",
      value: upcomingThisWeek?.length ?? 0,
      icon: Calendar,
      color: "bg-blue-50 text-blue-600",
      href: "/admin/kalender",
    },
    {
      label: "Offene Zahlungen",
      value: `${openPayments?.length ?? 0} · ${formatCHF(openPaymentsTotal)}`,
      icon: CreditCard,
      color: "bg-amber-50 text-amber-600",
      href: "/admin/zahlungen",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-800 text-[#1C244B]">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color, href }) => (
          <Link
            key={label}
            href={href ?? "#"}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-[#1C244B]/30 hover:-translate-y-1 hover:shadow-md transition-all duration-200 block"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-800 text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Was diese Woche liegt.
          Dieselben Punkte wie im Montags-Briefing, nur immer sichtbar —
          wer die Mail überliest oder abgeschaltet hat, findet es hier.
          Ohne Auffälligkeiten wird gar nichts angezeigt: Eine Karte, die
          meistens „alles gut" sagt, liest nach drei Wochen niemand mehr. */}
      {briefing.punkte.filter((p) => p.gewicht > 0).length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
          <h2 className="text-lg font-700 text-[#1C244B] mb-3">
            Diese Woche liegt
          </h2>
          <ul className="space-y-1.5">
            {briefing.punkte
              .filter((p) => p.gewicht > 0)
              .map((p, i) => (
                <li key={i} className="text-sm text-gray-800 flex gap-2">
                  <span className="text-amber-500 flex-shrink-0">•</span>
                  {p.text}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Lektionen ohne Eintrag.
          Nur sichtbar, wenn welche offen sind — eine Karte, die meistens
          „nichts offen" sagt, liest man nach zwei Wochen nicht mehr. */}
      {offeneNotizen.length > 0 && (
        <Link
          href="/admin/lektionen"
          className="block bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-[#1C244B]/30 hover:-translate-y-1 hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <NotebookPen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-700 text-[#1C244B]">
                {offeneNotizen.length === 1
                  ? "Eine Lektion ohne Eintrag"
                  : `${offeneNotizen.length} Lektionen ohne Eintrag`}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {offeneNotizen
                  .slice(0, 3)
                  .map((l) => l.name)
                  .join(", ")}
                {offeneNotizen.length > 3 ? " …" : ""}
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* Upcoming lessons */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">
          Nächste Lektionen
        </h2>

        {!nextLessons || nextLessons.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Keine bevorstehenden Lektionen</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {nextLessons.map((t) => {
              const s = t.profiles as unknown as {
                vorname: string;
                nachname: string;
              } | null;
              const v = vorschau[t.student_id as string];
              return (
                <li key={t.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-600 text-gray-900 truncate">
                        {s ? `${s.vorname} ${s.nachname}` : "—"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(t.start_at)}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-500 px-2.5 py-0.5 rounded-full flex-shrink-0 ${
                        statusColors[t.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {statusLabels[t.status] ?? t.status}
                    </span>
                  </div>

                  {/* Der Stand vom letzten Mal. Die Hausaufgabe steht zuoberst
                      und dunkler als der Rest: Sie ist das Einzige hier, das
                      man vor dem Klingeln wirklich gelesen haben muss. */}
                  {v && !v.leer && (
                    <div className="mt-1.5 pl-0.5 border-l-2 border-gray-100 pl-3 space-y-0.5">
                      {v.hausaufgabe && (
                        <p className="text-sm text-gray-800">
                          <span className="text-gray-400">Aufgabe: </span>
                          {v.hausaufgabe}
                        </p>
                      )}
                      {v.zuletzt && (
                        <p className="text-xs text-gray-500">
                          Zuletzt: {v.zuletzt}
                        </p>
                      )}
                      {v.inhalt.length > 0 && (
                        <p className="text-xs text-gray-400">
                          {v.inhalt.map(inhaltLabel).join(" · ")}
                        </p>
                      )}
                      {/* Ab der dritten Lektion in Folge ist es kein Zufall
                          mehr, sondern ein Hinweis auf die Methode. */}
                      {v.dranbleibenSeit >= 3 && (
                        <p className="text-xs font-600 text-amber-700">
                          Seit {v.dranbleibenSeit} Lektionen &bdquo;dranbleiben&ldquo;
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
