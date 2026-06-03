import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Music, Calendar, Package, CreditCard, LogOut } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/auth/actions";
import PaketCard from "./_components/PaketCard";
import NeuesPaket from "./_components/NeuesPaket";
import NaechsteTermine from "./_components/NaechsteTermine";
import TerminBuchen from "./_components/TerminBuchen";
import ZahlungenSection from "./_components/ZahlungenSection";
import { canBuyNewPackage, type Package as Paket } from "@/lib/packages";

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
    .select("id, desired_start, lessons_count, interval_days, status")
    .eq("student_id", user.id)
    .eq("status", "open")
    .order("desired_start", { ascending: true });

  const { data: offeneVerschiebungen } = await supabase
    .from("reschedule_requests")
    .select("id, appointment_id, original_start, proposed_start, status")
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

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-navy-50 rounded-full flex items-center justify-center mx-auto">
            <Music className="w-7 h-7 text-[#1C244B]" />
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

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#1C244B]">
            <span className="w-8 h-8 rounded-lg bg-[#1C244B] flex items-center justify-center">
              <Music className="w-4 h-4 text-white" />
            </span>
            <span className="font-700 text-base hidden sm:block">David</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <a href="#termine" className="px-3 py-1.5 text-gray-600 hover:text-[#1C244B] rounded-lg hover:bg-gray-100 transition-colors hidden sm:flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Termine
            </a>
            <a href="#zahlungen" className="px-3 py-1.5 text-gray-600 hover:text-[#1C244B] rounded-lg hover:bg-gray-100 transition-colors hidden sm:flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Zahlungen
            </a>
            <form action={logout}>
              <button type="submit" className="ml-2 px-3 py-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5 text-sm">
                <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Abmelden</span>
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 to-navy-700 px-6 py-7 sm:px-8 sm:py-8 shadow-lg shadow-navy-900/10 animate-fade-in">
          <div className="absolute -top-16 -right-12 w-64 h-64 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <div className="relative">
            <h1 className="text-2xl sm:text-3xl font-800 text-white">
              Hallo, {vorname} 👋
            </h1>
            <p className="text-white/60 text-sm mt-1">
              Willkommen in deinem Schülerportal
            </p>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <HeroStat
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
              />
              <HeroStat
                label="Verbleibend"
                value={
                  remainingLessons != null
                    ? `${remainingLessons} Lektion${remainingLessons !== 1 ? "en" : ""}`
                    : "Kein Paket"
                }
              />
              <HeroStat
                label="Offene Zahlungen"
                value={
                  openPaymentsCount > 0 ? String(openPaymentsCount) : "Keine"
                }
                highlight={openPaymentsCount > 0}
              />
            </div>
          </div>
        </div>

        <section id="paket" className="space-y-4">
          <SectionHeader icon={<Package className="w-4 h-4" />} title="Mein Paket" />
          <PaketCard
            paket={aktivesPackage}
            lessonsUsed={lessonsUsed}
            upcomingAbsence={kommendeAbwesenheit}
          />
          <div>
            <h3 className="text-sm font-600 text-gray-500 mb-2">Neues Paket buchen</h3>
            <NeuesPaket prices={prices} canBuy={kannNeuesPaket} />
          </div>
        </section>

        <section id="termine">
          <SectionHeader icon={<Calendar className="w-4 h-4" />} title="Nächste Lektionen" />
          <NaechsteTermine
            appointments={naechsteAppointments ?? []}
            requests={offeneAnfragen ?? []}
            reschedules={offeneVerschiebungen ?? []}
          />
          {aktivesPackage && canBook && (
            <div className="mt-4">
              <TerminBuchen />
            </div>
          )}
        </section>

        <section id="zahlungen">
          <SectionHeader icon={<CreditCard className="w-4 h-4" />} title="Zahlungen" />
          <ZahlungenSection invoices={invoices ?? []} />
        </section>
      </main>
    </div>
  );
}

function HeroStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur-sm px-4 py-3 ring-1 ring-white/10">
      <p className="text-[11px] font-600 uppercase tracking-wide text-white/50">
        {label}
      </p>
      <p
        className={`mt-1 font-700 text-sm sm:text-base ${
          highlight ? "text-gold-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[#1C244B]">{icon}</span>
      <h2 className="text-lg font-700 text-[#1C244B]">{title}</h2>
    </div>
  );
}
