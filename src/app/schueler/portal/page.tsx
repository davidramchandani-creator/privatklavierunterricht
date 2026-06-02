import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Music, Calendar, Package, CreditCard, Star, LogOut } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/auth/actions";
import PaketCard from "./_components/PaketCard";
import NeuesPaket from "./_components/NeuesPaket";
import NaechsteTermine from "./_components/NaechsteTermine";
import TerminBuchen from "./_components/TerminBuchen";
import ZahlungenSection from "./_components/ZahlungenSection";
import BewertungSection from "./_components/BewertungSection";
import { canBuyNewPackage, type Package as Paket } from "@/lib/packages";

export default async function SchuelerPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: schueler } = await supabase
    .from("schueler")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Neues Schema: aktives Paket + Profilpreise (Meilenstein 3)
  const { data: profile } = await supabase
    .from("profiles")
    .select("price_single, price_10er, price_20er, travel_surcharge")
    .eq("id", user.id)
    .maybeSingle();

  const { data: packagesRows } = await supabase
    .from("packages")
    .select("*")
    .eq("student_id", user.id)
    .order("erstellt_am", { ascending: false });

  // Aktivstes Paket auswählen: bevorzugt ein nutzbares aktives Paket,
  // sonst das zuletzt erstellte (für Status-Anzeige).
  const aktivesPackage: Paket | null =
    (packagesRows as Paket[] | null)?.find(
      (p) => p.status === "active" && !canBuyNewPackage(p)
    ) ??
    (packagesRows as Paket[] | null)?.[0] ??
    null;

  // Genutzte Lektionen aus tatsächlichen Appointments berechnen (Spec §3)
  let lessonsUsed = aktivesPackage?.lessons_used ?? 0;
  if (aktivesPackage) {
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("package_id", aktivesPackage.id)
      .in("status", ["booked", "completed"]);
    if (count != null) lessonsUsed = count;
  }

  // Kommende Abwesenheit (eigene oder Admin-weite) für Hinweis
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
  // Buchen erlaubt, wenn ein nutzbares aktives Paket vorhanden ist.
  const canBook = !!aktivesPackage && !canBuyNewPackage(aktivesPackage);

  // Neue Termine (appointments) + offene Terminanfragen (Meilenstein 5)
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

  // Rechnungen aus neuem Schema (Meilenstein 9)
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, status, method, lesson_date, pdf_url, access_token, appointment_id")
    .eq("student_id", user.id)
    .not("status", "in", '("archived","cancelled")')
    .order("lesson_date", { ascending: false })
    .limit(20);

  const { data: meineBewertung } = await supabase
    .from("bewertungen")
    .select("*")
    .eq("schueler_id", schueler?.id ?? "")
    .maybeSingle();

  const vorname = schueler?.vorname ?? user.email?.split("@")[0] ?? "Schüler";

  // No schueler record yet – admin hasn't created the profile
  if (!schueler) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
            <Music className="w-7 h-7 text-[#1C244B]" />
          </div>
          <h1 className="text-xl font-800 text-gray-900">Willkommen, {vorname}!</h1>
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
            <a href="#bewertung" className="px-3 py-1.5 text-gray-600 hover:text-[#1C244B] rounded-lg hover:bg-gray-100 transition-colors hidden sm:flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5" /> Bewertung
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
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-800 text-[#1C244B]">Hallo, {vorname} 👋</h1>
          <p className="text-gray-500 text-sm mt-1">Willkommen in deinem Schülerportal</p>
        </div>

        {/* Paket */}
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

        {/* Termine */}
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

        {/* Zahlungen */}
        <section id="zahlungen">
          <SectionHeader icon={<CreditCard className="w-4 h-4" />} title="Zahlungen" />
          <ZahlungenSection invoices={invoices ?? []} />
        </section>

        {/* Bewertung */}
        <section id="bewertung">
          <SectionHeader icon={<Star className="w-4 h-4" />} title="Bewertung abgeben" />
          <BewertungSection schueler_id={schueler?.id ?? ""} vorhandene={meineBewertung} vorname={vorname} />
        </section>
      </main>
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
