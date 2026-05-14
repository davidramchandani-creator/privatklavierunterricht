import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Music, Calendar, Package, CreditCard, Star, LogOut } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/auth/actions";
import PaketCard from "./_components/PaketCard";
import NaechsteTermine from "./_components/NaechsteTermine";
import TerminBuchen from "./_components/TerminBuchen";
import ZahlungenSection from "./_components/ZahlungenSection";
import BewertungSection from "./_components/BewertungSection";

export default async function SchuelerPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: schueler } = await supabase
    .from("schueler")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { data: aktivPaket } = await supabase
    .from("pakete")
    .select("*")
    .eq("schueler_id", schueler?.id ?? "")
    .eq("aktiv", true)
    .single();

  const { data: naechsteTermine } = await supabase
    .from("termine")
    .select("*")
    .eq("schueler_id", schueler?.id ?? "")
    .gte("beginn", new Date().toISOString())
    .order("beginn", { ascending: true })
    .limit(5);

  const { data: zahlungen } = await supabase
    .from("zahlungen")
    .select("*")
    .eq("schueler_id", schueler?.id ?? "")
    .order("faellig_am", { ascending: false })
    .limit(10);

  const { data: meineBewertung } = await supabase
    .from("bewertungen")
    .select("*")
    .eq("schueler_id", schueler?.id ?? "")
    .maybeSingle();

  const vorname = schueler?.vorname ?? user.email?.split("@")[0] ?? "Schüler";

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
        <section id="paket">
          <SectionHeader icon={<Package className="w-4 h-4" />} title="Mein Paket" />
          <PaketCard paket={aktivPaket} />
        </section>

        {/* Termine */}
        <section id="termine">
          <SectionHeader icon={<Calendar className="w-4 h-4" />} title="Nächste Lektionen" />
          <NaechsteTermine termine={naechsteTermine ?? []} schueler_id={schueler?.id ?? ""} />
          {aktivPaket && (
            <div className="mt-4">
              <TerminBuchen schueler_id={schueler?.id ?? ""} paket_id={aktivPaket.id} />
            </div>
          )}
        </section>

        {/* Zahlungen */}
        <section id="zahlungen">
          <SectionHeader icon={<CreditCard className="w-4 h-4" />} title="Zahlungen" />
          <ZahlungenSection zahlungen={zahlungen ?? []} />
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
