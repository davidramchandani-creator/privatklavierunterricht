import type { Metadata } from "next";
import SeitenKopf from "@/components/SeitenKopf";
import Reveal from "@/components/Reveal";
import Hoerproben from "@/components/sections/Hoerproben";
import Bewertungen from "@/components/sections/Bewertungen";
import ProbelektionCTA from "@/components/sections/ProbelektionCTA";
import { HOERPROBEN } from "@/lib/hoerproben";

/**
 * Hören und sehen, bevor man sich anmeldet: meine Aufnahmen, die Videos der
 * Schülerinnen und Schüler und was sie über den Unterricht sagen.
 *
 * Dieselben Abschnitte wie auf der Startseite, gebündelt für alle, die
 * gezielt danach suchen.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Einblicke: Hörproben, Schülervideos, Bewertungen",
  description:
    "Hör rein und schau zu: Aufnahmen von David, Videos von Schülerinnen und Schülern aus dem Unterricht und ihre Bewertungen.",
  alternates: { canonical: "/einblicke" },
};

export default function EinblickePage() {
  return (
    <main>
      <SeitenKopf
        kicker="Einblicke"
        titel={
          <>
            Hör rein, <span className="italic font-700 text-white/80">schau zu.</span>
          </>
        }
        text="Aufnahmen von mir, Videos aus dem Unterricht und was Schülerinnen und Schüler sagen."
        sprungmarken={[
          { href: "#hoerproben", label: "Hörproben" },
          { href: "#videos", label: "Schülervideos" },
          { href: "#stimmen", label: "Bewertungen" },
        ]}
      />

      <Hoerproben proben={HOERPROBEN} />

      <Reveal>
        <Bewertungen />
      </Reveal>

      <ProbelektionCTA />
    </main>
  );
}
