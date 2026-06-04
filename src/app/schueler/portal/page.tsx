import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Music } from "lucide-react";
import PortalNav from "./_components/PortalNav";
import PaketCard from "./_components/PaketCard";
import NeuesPaket from "./_components/NeuesPaket";
import NaechsteTermine from "./_components/NaechsteTermine";
import TerminBuchen from "./_components/TerminBuchen";
import ZahlungenSection from "./_components/ZahlungenSection";
import ProposalCard from "./_components/ProposalCard";
import PortalTabs from "./_components/PortalTabs";
import { canBuyNewPackage, type Package as Paket } from "@/lib/packages";
import { getTwintBaseUrl } from "@/lib/twint";

export default async function SchuelerPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, vorname, nachname, price_single, price_10er, price_20er, travel_surcharge")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") redirect("/admin");

  const { data: packagesRows } = await supabase
    .from("packages")
    .select("*")
    .eq("student_id", user.id)
    .order("erstellt_am", { ascending: false });

  const aktivesPackage: Paket | null =
    (packagesRows as Paket[] | null)?.find(
      (p) => p.status === "active" && !canBuyNewPackage(p)
    ) ??
    (packagesRows as Paket[] | null)?.[0] ??
    null;

  let lessonsUsed = aktivesPackage?.lessons_used ?? 0;
  if (aktivesPackage) {
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("package_id", aktivesPackage.id)
      .in("status", ["booked", "completed"]);
    if (count != null) lessonsUsed = count;
  }

  const heute = new Date().toISOString().split("T")[0];
  const { data: kommendeAbwesenheit } = await supabase
    .from("absences")
    .select("start_date, end_date, title, scope, student_id")
    .gte("end_date", heute)
    .or(`scope.eq.admin,student_id.eq.${user.id}`)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const prices = {
    price_10er: Number(profile?.price_10er ?? 70),
    price_20er: Number(profile?.price_20er ?? 65),
    travel_surcharge: Number(profile?.travel_surcharge ?? 0),
  };

  const kannNeuesPaket = canBuyNewPackage(aktivesPackage);
  const canBook = !!aktivesPackage && !canBuyNewPackage(aktivesPackage);

  const { data: naechsteAppointments } = await supabase
    .from("appointments")
    .select("id, start_at, end_at, status")
    .eq("student_id", user.id)
    .in("status", ["booked", "completed"])
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(10);

  const { data: offeneAnfragen } = await supabase
    .from("booking_requests")
    .select("id, desired_start, lessons_count, interval_days, status, group_id")
    .eq("student_id", user.id)
    .eq("status", "open")
    .order("desired_start", { ascending: true });

  const { data: offeneVerschiebungen } = await supabase
    .from("reschedule_requests")
    .select("id, appointment_id, original_start, proposed_start, status")
    .eq("student_id", user.id)
    .eq("status", "open")
    .order("proposed_start", { ascending: true });

  const { data: offeneProposals } = await supabase
    .from("proposals")
    .select("id, proposed_start, lessons_count, interval_days, status")
    .eq("student_id", user.id)
    .eq("status", "open")
    .order("proposed_start", { ascending: true });

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, status, method, lesson_date, pdf_url, access_token, appointment_id")
    .eq("student_id", user.id)
    .not("status", "in", '("archived","cancelled")')
    .order("lesson_date", { ascending: false })
    .limit(20);

  const vorname = profile?.vorname ?? user.email?.split("@")[0] ?? "Schüler";

  // Auf-einen-Blick-Stats für den Hero
  const nextLessonAt = naechsteAppointments?.[0]?.start_at ?? null;
  const remainingLessons =
    aktivesPackage != null
      ? Math.max(0, aktivesPackage.lessons_total - lessonsUsed)
      : null;
  const openPaymentsCount =
    invoices?.filter((i) => i.status === "unpaid" || i.status === "rejected")
      .length ?? 0;

  // Offizieller TWINT-Acquirer-Link (serverseitig, nie im Client hartcodiert).
  const twintBase = getTwintBaseUrl();
  const invoicesForPortal = (invoices ?? []).map((inv) => ({
    ...inv,
    twint_link: inv.method === "twint" ? twintBase : null,
  }));

  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-5">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#EAECEF] p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-navy-50 rounded-2xl flex items-center justify-center mx-auto">
            <Music className="w-7 h-7 text-navy-900" />
          </div>
          <h1 className="text-xl font-800 text-gray-900">Willkommen!</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Dein Schülerprofil wird noch von David eingerichtet. Das dauert
            normalerweise nur kurz – schreib ihm eine kurze Nachricht wenn es
            dringend ist.
          </p>
          <a
            href="mailto:david.privatklavierunterricht@gmail.com"
            className="inline-block text-sm text-[#1C244B] font-600 hover:underline"
          >
            david.privatklavierunterricht@gmail.com
          </a>
        </div>
      </div>
    );
  }

  const uebersicht = (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Nächste Lektion"
          value={
            nextLessonAt
              ? new Intl.DateTimeFormat("de-CH", {
                  timeZone: "Europe/Zurich",
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                }).format(new Date(nextLessonAt))
              : "—"
          }
          hint={nextLessonAt ? "geplant" : "keine geplant"}
        />
        <StatCard
          label="Verbleibende Lektionen"
          value={remainingLessons != null ? String(remainingLessons) : "0"}
          hint={remainingLessons != null ? "im aktiven Paket" : "kein aktives Paket"}
        />
        <StatCard
          label="Offene Zahlungen"
          value={openPaymentsCount > 0 ? String(openPaymentsCount) : "0"}
          hint={openPaymentsCount > 0 ? "zu begleichen" : "alles bezahlt"}
          accent={openPaymentsCount > 0}
        />
      </div>

      <div className="space-y-5">
        <SectionHeader title="Mein Paket" />
        <PaketCard
          paket={aktivesPackage}
          lessonsUsed={lessonsUsed}
          upcomingAbsence={kommendeAbwesenheit}
        />
        <div className="pt-1">
          <p className="text-[13px] font-600 text-gray-400 mb-2.5">Neues Paket buchen</p>
          <NeuesPaket prices={prices} canBuy={kannNeuesPaket} />
        </div>
      </div>
    </div>
  );

  const termine = (
    <div className="space-y-5">
      <ProposalCard proposals={offeneProposals ?? []} />
      <NaechsteTermine
        appointments={naechsteAppointments ?? []}
        requests={offeneAnfragen ?? []}
        reschedules={offeneVerschiebungen ?? []}
      />
      {aktivesPackage && canBook && remainingLessons != null && remainingLessons > 0 && (
        <div className="pt-1">
          <TerminBuchen maxSlots={remainingLessons} />
        </div>
      )}
    </div>
  );

  const zahlungen = (
    <div className="space-y-5">
      <ZahlungenSection invoices={invoicesForPortal} />
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <PortalNav vorname={vorname} />

      <main className="max-w-4xl mx-auto px-5 py-8 sm:py-10">
        <div className="mb-6">
          <p className="text-[13px] font-500 text-gray-400">Schön, dass du da bist</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-700 text-navy-900 tracking-tight">
            Hallo, {vorname}
          </h1>
        </div>

        <PortalTabs
          uebersicht={uebersicht}
          termine={termine}
          zahlungen={zahlungen}
          termineBadge={offeneProposals?.length ?? 0}
          zahlungenBadge={openPaymentsCount}
        />
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#EAECEF] bg-white px-5 py-4 transition-colors hover:border-gray-300/70">
      <p className="text-[11px] font-600 uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p
        className={`mt-1.5 text-2xl font-700 tracking-tight ${
          accent ? "text-red-500" : "text-navy-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-base font-700 text-navy-900 tracking-tight">{title}</h2>
  );
}
