import Hero from "@/components/sections/Hero";
import Hoerproben from "@/components/sections/Hoerproben";
import Pakete from "@/components/sections/Pakete";
import Preisrechner from "@/components/sections/Preisrechner";
import Vorteile from "@/components/sections/Vorteile";
import Bewertungen from "@/components/sections/Bewertungen";
import UeberMichTeaser from "@/components/sections/UeberMichTeaser";
import ProbelektionCTA from "@/components/sections/ProbelektionCTA";
import Reveal from "@/components/Reveal";
import BuchungsLeiste from "@/components/BuchungsLeiste";
import { naechsterTerminText } from "@/lib/naechster-termin";
import { HOERPROBEN } from "@/lib/hoerproben";

// Nächster freier Termin im Hero soll aktuell bleiben → stündlich neu rendern.
// Immer frisch rendern: Der Hero zeigt den nächsten freien Termin – mit ISR
// (stale-while-revalidate) konnte bei wenig Traffic ein vergangener Termin
// angezeigt werden.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const naechsterTermin = await naechsterTerminText(true);

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

      {/*
        Ganze Abschnitte einblenden statt einzelne Elemente darin.

        Innerhalb jeder Section zu staffeln sähe erst besser aus, wird beim
        Scrollen aber zappelig: Überschrift, dann Karte eins, dann Karte
        zwei — man liest gegen die Bewegung an. Ein Abschnitt, eine Bewegung.
      */}
      <Reveal>
        <Vorteile />
      </Reveal>
      <Reveal>
        <UeberMichTeaser />
      </Reveal>
      <Reveal>
        <Bewertungen />
      </Reveal>
      <Reveal>
        <Pakete />
      </Reveal>
      <Reveal>
        <Preisrechner />
      </Reveal>

      {/* Der Schlussaufruf bleibt ohne Einblendung – er ist der Boden der
          Seite und soll da sein, sobald man ankommt. */}
      <ProbelektionCTA />

      <BuchungsLeiste naechsterTermin={naechsterTermin} />
    </main>
  );
}
