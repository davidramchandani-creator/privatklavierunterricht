import type { Metadata } from "next";
import SeitenKopf from "@/components/SeitenKopf";
import AbschnittsKopf from "@/components/AbschnittsKopf";
import Reveal from "@/components/Reveal";
import Vorteile from "@/components/sections/Vorteile";
import Pakete from "@/components/sections/Pakete";
import ProbelektionCTA from "@/components/sections/ProbelektionCTA";
import { ERSTE_SCHRITTE } from "@/lib/ablauf";

/**
 * Alles zum Unterricht auf einer Seite: wie ich unterrichte, die Angebote
 * (einzeln und als Gruppe) und wie man anfängt.
 *
 * Die Abschnitte sind dieselben wie auf der Startseite, nichts doppelt
 * formuliert. Die Startseite erzählt der Reihe nach, diese Seite ist für
 * alle, die gezielt über das Menü kommen.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Unterricht: einzeln oder als Gruppe",
  description:
    "Klavierunterricht im Studio in Neftenbach: Einzelunterricht, Gruppen zu zweit oder zu dritt und wie du mit einer Probelektion anfängst.",
  alternates: { canonical: "/unterricht" },
};

export default function UnterrichtPage() {
  return (
    <main>
      <SeitenKopf
        kicker="Unterricht"
        titel={
          <>
            Klavierunterricht im Studio <span className="italic font-700 text-white/80">in Neftenbach</span>
          </>
        }
        text="Individueller Klavierunterricht mit David, ganz ohne Schema F, dafür mit Gefühl und Verstand. Einzeln oder zusammen mit Freunden."
        sprungmarken={[
          { href: "#einzel", label: "Einzelunterricht" },
          { href: "#gruppen", label: "Zu zweit oder zu dritt" },
          { href: "#ablauf", label: "So startest du" },
        ]}
      />

      <Reveal>
        <Vorteile />
      </Reveal>

      <div id="einzel" className="scroll-mt-16">
        <Pakete />
      </div>

      <section id="ablauf" className="py-16 md:py-24 bg-surface scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AbschnittsKopf
            kicker="So startest du"
            titel="Von der Anfrage zur ersten Lektion"
            className="mb-10"
          />
          <ol className="grid md:grid-cols-3 gap-5">
            {ERSTE_SCHRITTE.map((s, i) => (
              <li
                key={s.titel}
                className="bg-white rounded-2xl border border-[#EAECEF] p-6 hover:-translate-y-1 hover:shadow-lg hover:shadow-navy-100/60 transition-all duration-300"
              >
                <span className="w-9 h-9 rounded-full bg-navy-900 text-white text-sm font-700 flex items-center justify-center tabular-nums">
                  {i + 1}
                </span>
                <h3 className="font-700 text-navy-900 mt-4">{s.titel}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mt-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ProbelektionCTA />
    </main>
  );
}
