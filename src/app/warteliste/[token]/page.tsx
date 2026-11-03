import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { angebotZustand } from "@/lib/warteliste";
import Logo from "@/components/layout/Logo";
import AngebotAntwort from "./AngebotAntwort";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Platzangebot",
  robots: { index: false, follow: false },
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AngebotSeite({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: eintrag } = await admin
    .from("warteliste")
    .select("vorname, status, angebot_text, angebot_frist")
    .eq("angebot_token", token)
    .maybeSingle();

  const zustand = angebotZustand(eintrag, new Date());

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-white border-b border-[#EAECEF]">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center">
          <Link href="/" className="text-navy-900">
            <Logo className="h-6 w-auto" />
          </Link>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl border border-[#EAECEF] shadow-sm p-8 space-y-5 animate-enter-up">
          {zustand === "offen" && eintrag ? (
            <>
              <h1 className="text-2xl font-800 text-navy-900 tracking-tight">
                Hallo {eintrag.vorname}, ein Platz ist frei
              </h1>
              <div className="bg-navy-50 border border-navy-100 rounded-xl p-4">
                <p className="text-lg font-700 text-navy-900">{eintrag.angebot_text}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Im Studio in Neftenbach, 45 Minuten pro Lektion.{" "}
                  <Link href="/preise" className="underline underline-offset-2">
                    Preise ansehen
                  </Link>
                </p>
              </div>
              {eintrag.angebot_frist && (
                <p className="text-sm text-gray-500">
                  Bitte antworte bis {fmt(eintrag.angebot_frist)}.
                </p>
              )}
              <AngebotAntwort token={token} />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-800 text-navy-900 tracking-tight">
                {zustand === "abgelaufen"
                  ? "Die Frist ist abgelaufen"
                  : zustand === "beantwortet"
                    ? "Danke für deine Antwort"
                    : "Dieser Link ist ungültig"}
              </h1>
              <p className="text-gray-500 leading-relaxed">
                {zustand === "abgelaufen"
                  ? "Leider ist die Frist für dieses Angebot vorbei. Du bleibst auf der Warteliste, und ich melde mich, sobald wieder ein Platz frei wird."
                  : zustand === "beantwortet"
                    ? "Du hast auf dieses Angebot schon geantwortet. Ich melde mich bei dir."
                    : "Vielleicht wurde das Angebot zurückgezogen. Bei Fragen schreib mir einfach."}
              </p>
              <Link href="/kontakt" className="text-sm font-600 text-navy-900 underline underline-offset-4">
                Kontakt
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
