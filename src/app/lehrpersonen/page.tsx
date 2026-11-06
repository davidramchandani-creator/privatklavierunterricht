import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import LehrpersonKarte from "@/components/LehrpersonKarte";
import { ladeOeffentlicheLehrpersonen } from "@/lib/lehrpersonen-server";

export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: "/lehrpersonen" },
  title: "Wer unterrichtet dich? Lehrpersonen bei Privatklavierunterricht",
  description:
    "Die Lehrpersonen von privatklavierunterricht.ch: im Studio in Neftenbach oder in der Region Winterthur. Anmeldung und Kontakt laufen über David.",
};

/**
 * „Wer unterrichtet dich?“
 *
 * Nur aktive Lehrpersonen mit freigegebenem Text. Keine Kontaktdaten, keine
 * Adressen: Wer Unterricht möchte, meldet sich über das Formular, und
 * David teilt zu.
 */
export default async function LehrpersonenPage() {
  const liste = await ladeOeffentlicheLehrpersonen().catch(() => []);

  return (
    <main>
      <section className="bg-navy-900 pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-white space-y-4">
          <h1 className="text-3xl sm:text-4xl font-800">Wer unterrichtet dich?</h1>
          <p className="text-white/70 text-lg leading-relaxed">
            Im Studio in Neftenbach oder in der Region Winterthur. Du meldest dich bei mir, und ich schaue,
            wer am besten zu dir passt.
          </p>
        </div>
      </section>

      <section className="py-16 px-4 bg-surface">
        <div className="max-w-5xl mx-auto space-y-10">
          {liste.length === 0 ? (
            <p className="text-gray-500 text-center">Die Vorstellungen folgen in Kürze.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {liste.map((l) => (
                <LehrpersonKarte key={l.id} l={l} />
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 sm:p-8 text-center space-y-3">
            <h2 className="text-xl font-800 text-navy-900">So kommst du zum Unterricht</h2>
            <p className="text-gray-600 max-w-xl mx-auto leading-relaxed">
              Schreib mir, wann du Zeit hast und ob du ins Studio kommst oder Unterricht in der Region
              Winterthur möchtest. Ich kläre ab, wer passt, und melde mich mit Lehrperson, Ort und Termin.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link href="/probelektion">
                <Button>Probelektion anfragen</Button>
              </Link>
              <Link href="/kontakt">
                <Button variant="outline">Kontakt</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
