import Hero from "@/components/sections/Hero";
import Pakete from "@/components/sections/Pakete";
import Preisrechner from "@/components/sections/Preisrechner";
import Vorteile from "@/components/sections/Vorteile";
import Bewertungen from "@/components/sections/Bewertungen";
import UeberMichTeaser from "@/components/sections/UeberMichTeaser";
import ProbelektionCTA from "@/components/sections/ProbelektionCTA";

// Nächster freier Termin im Hero soll aktuell bleiben → stündlich neu rendern.
// Immer frisch rendern: Der Hero zeigt den nächsten freien Termin – mit ISR
// (stale-while-revalidate) konnte bei wenig Traffic ein vergangener Termin
// angezeigt werden.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Pakete />
      <Preisrechner />
      <Vorteile />
      <Bewertungen />
      <UeberMichTeaser />
      <ProbelektionCTA />
    </main>
  );
}
