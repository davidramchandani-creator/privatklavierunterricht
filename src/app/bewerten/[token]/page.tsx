import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Link2Off } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import Logo from "@/components/layout/Logo";
import BewertungsFormular from "./_components/BewertungsFormular";

export const dynamic = "force-dynamic";

// Keine Suchmaschine soll Bewertungslinks in den Index nehmen. Sie tragen
// einen Token und gehören genau einer Person.
export const metadata: Metadata = {
  title: "Bewertung abgeben",
  robots: { index: false, follow: false },
};

function Rahmen({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F3F5F8] flex flex-col items-center px-4 py-12">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <div className="w-full max-w-lg bg-white rounded-2xl border border-[#EAECEF] shadow-sm p-6 sm:p-8">
        {children}
      </div>
    </main>
  );
}

export default async function BewertenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = await createAdminClient();

  const { data: einladung } = await admin
    .from("review_einladungen")
    .select("id, benutzt_am, profiles(vorname)")
    .eq("token", token)
    .maybeSingle();

  if (!einladung) {
    return (
      <Rahmen>
        <div className="text-center space-y-3">
          <span className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto">
            <Link2Off className="w-5 h-5 text-gray-400" />
          </span>
          <h1 className="text-xl font-800 text-[#1C244B]">Link nicht gefunden</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Dieser Link stimmt nicht. Vielleicht ist beim Kopieren ein Stück
            verloren gegangen. Schreib mir kurz, dann schicke ich dir einen neuen.
          </p>
          <Link
            href="/kontakt"
            className="inline-block text-sm font-600 text-[#1C244B] underline underline-offset-4"
          >
            Kontakt
          </Link>
        </div>
      </Rahmen>
    );
  }

  if (einladung.benutzt_am) {
    return (
      <Rahmen>
        <div className="text-center space-y-3">
          <span className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </span>
          <h1 className="text-xl font-800 text-[#1C244B]">Schon erledigt</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Über diesen Link wurde bereits eine Bewertung abgegeben. Vielen Dank
            dafür.
          </p>
          <Link
            href="/"
            className="inline-block text-sm font-600 text-[#1C244B] underline underline-offset-4"
          >
            Zur Website
          </Link>
        </div>
      </Rahmen>
    );
  }

  const profil = Array.isArray(einladung.profiles)
    ? einladung.profiles[0]
    : einladung.profiles;
  const vorname = (profil as { vorname?: string } | null)?.vorname ?? "";

  return (
    <Rahmen>
      <BewertungsFormular token={token} vorname={vorname} />
    </Rahmen>
  );
}
