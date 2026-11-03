import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import Logo from "@/components/layout/Logo";
import WartelisteFormular from "@/components/WartelisteFormular";
import PlatzHinweis from "@/components/PlatzHinweis";
import { ladePlatzstatus } from "@/lib/platzstatus-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Warteliste: Klavierunterricht in Neftenbach",
  description:
    "Zurzeit sind fast alle festen Plätze vergeben. Trag dich auf die Warteliste ein, ich melde mich, sobald ein Platz frei wird.",
  alternates: { canonical: "/warteliste" },
};

export default async function WartelistePage() {
  const status = await ladePlatzstatus().catch(() => null);
  const ausgebucht = status?.stufe === "ausgebucht";

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-white border-b border-[#EAECEF] sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center text-navy-900 hover:opacity-80 transition-opacity">
            <Logo className="h-6 w-auto" />
          </Link>
          <Link
            href="/"
            className="press inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Zur Startseite
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8 animate-enter-up">
        <div className="text-center space-y-3">
          {status && (
            <div className="flex justify-center">
              <PlatzHinweis status={status} />
            </div>
          )}
          <h1 className="text-3xl font-800 text-navy-900 tracking-tight">Warteliste</h1>
          <p className="text-gray-500 max-w-lg mx-auto leading-relaxed">
            {ausgebucht
              ? "Zurzeit sind alle festen Plätze vergeben. Trag dich ein, und ich melde mich per Mail, sobald ein Platz frei wird, der zu deinen Zeiten passt."
              : "Passt dir gerade keiner der freien Termine? Trag dich ein, und ich melde mich, sobald ein Platz frei wird, der zu deinen Zeiten passt."}
          </p>
          {!ausgebucht && (
            <p className="text-sm">
              <Link href="/probelektion" className="font-600 text-navy-900 underline underline-offset-4">
                Lieber gleich eine Probelektion buchen
              </Link>
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#EAECEF] shadow-sm p-6 sm:p-8">
          <WartelisteFormular />
        </div>

        <p className="text-xs text-gray-400 text-center max-w-md mx-auto leading-relaxed">
          Die Anmeldung ist unverbindlich und kostenlos. Deine Angaben verwende ich nur, um dich
          wegen eines freien Platzes zu kontaktieren. Du kannst dich jederzeit abmelden, eine kurze
          Antwort auf mein Mail genügt.
        </p>
      </main>
    </div>
  );
}
