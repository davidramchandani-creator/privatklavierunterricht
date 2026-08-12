import Hero from "@/components/sections/Hero";
import Hoerproben from "@/components/sections/Hoerproben";
import Pakete from "@/components/sections/Pakete";
import Preisrechner from "@/components/sections/Preisrechner";
import Vorteile from "@/components/sections/Vorteile";
import Bewertungen from "@/components/sections/Bewertungen";
import UeberMichTeaser from "@/components/sections/UeberMichTeaser";
import ProbelektionCTA from "@/components/sections/ProbelektionCTA";
import { HOERPROBEN } from "@/lib/hoerproben";

// Nächster freier Termin im Hero soll aktuell bleiben → stündlich neu rendern.
// Immer frisch rendern: Der Hero zeigt den nächsten freien Termin – mit ISR
// (stale-while-revalidate) konnte bei wenig Traffic ein vergangener Termin
// angezeigt werden.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main>
      <Hero />
      {/*
        Reihenfolge: erst können, dann Person, dann Beleg, dann Preis.

        Vorher standen die Pakete direkt nach dem Hero — der Preis war damit
        das Zweite, was ein Besucher sah. Ein Preis ohne aufgebauten Wert
        wirkt immer hoch. Jetzt hört er zuerst, wie es klingt.
      */}
      <Hoerproben proben={HOERPROBEN} />
      <Vorteile />
      <UeberMichTeaser />
      <Bewertungen />
      <Pakete />
      <Preisrechner />
      <ProbelektionCTA />
    </main>
  );
}
