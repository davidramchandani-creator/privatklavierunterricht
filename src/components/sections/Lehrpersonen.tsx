import Link from "next/link";
import { ArrowRight } from "lucide-react";
import AbschnittsKopf from "@/components/AbschnittsKopf";
import LehrpersonKarte from "@/components/LehrpersonKarte";
import { ladeOeffentlicheLehrpersonen } from "@/lib/lehrpersonen-server";

/**
 * „Wer unterrichtet dich?“ auf der Startseite.
 *
 * Erscheint erst ab zwei öffentlichen Lehrpersonen. Solange David allein
 * unterrichtet, erzählt der Abschnitt „Über mich“ dasselbe besser.
 */
export default async function Lehrpersonen() {
  const liste = await ladeOeffentlicheLehrpersonen().catch(() => []);
  if (liste.length < 2) return null;

  return (
    <section className="py-16 md:py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AbschnittsKopf
          kicker="Lehrpersonen"
          titel="Wer unterrichtet dich?"
          text="Im Studio in Neftenbach oder in der Region Winterthur und Zürich. Du meldest dich bei mir, und ich schaue, wer am besten zu dir passt."
          className="mb-10"
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {liste.slice(0, 3).map((l) => (
            <LehrpersonKarte key={l.id} l={l} />
          ))}
        </div>
        <Link
          href="/lehrpersonen"
          className="inline-flex items-center gap-2 mt-8 text-sm font-600 text-navy-900 underline decoration-navy-200 hover:decoration-navy-900 underline-offset-4"
        >
          Alle Lehrpersonen <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
