import Hero from "@/components/sections/Hero";
import Pakete from "@/components/sections/Pakete";
import Preisrechner from "@/components/sections/Preisrechner";
import Vorteile from "@/components/sections/Vorteile";
import Bewertungen from "@/components/sections/Bewertungen";
import UeberMichTeaser from "@/components/sections/UeberMichTeaser";
import ProbelektionCTA from "@/components/sections/ProbelektionCTA";

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
