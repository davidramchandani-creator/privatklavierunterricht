import { Metadata } from "next";
import Link from "next/link";
import { Check, Car, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Preisrechner from "@/components/sections/Preisrechner";

export const metadata: Metadata = {
  title: "Preise & Transparenz – Privatklavierunterricht David Ramchandani",
  description:
    "Wie sich meine Unterrichtspreise zusammensetzen und warum sie fair und nachhaltig sind. Einzellektion CHF 85, 10er-Paket CHF 70, 20er-Paket CHF 65 pro Lektion.",
};

const modelle = [
  { modell: "Einzellektion", preis: "CHF 85.–" },
  { modell: "10er-Paket", preis: "CHF 70.–" },
  { modell: "20er-Paket", preis: "CHF 65.–" },
];

const leistungen = [
  "Hohe Unterrichtsqualität – 16 Jahre Spielerfahrung, individuelle Methoden ohne Notenzwang",
  "Vorbereitung und Nachbearbeitung jeder Lektion",
  "Nutzung von Material, Equipment und Software",
  "Faire Entlohnung, damit ich Studium und Unterricht langfristig vereinbaren kann",
  "Rabattierte Pakete für langfristige Schüler – Musik braucht Zeit und Entwicklung",
];

export default function PreisePage() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-navy-900 pt-32 pb-16 px-4 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="max-w-3xl mx-auto relative text-white space-y-5">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-500 text-white/80">
            <ShieldCheck className="w-4 h-4" />
            Gültig ab 01.04.2026
          </div>
          <h1 className="text-4xl sm:text-5xl font-800 leading-tight">
            Preise &amp; <span className="italic">Transparenz</span>
          </h1>
          <p className="text-white/70 text-lg leading-relaxed">
            Wie sich meine Unterrichtspreise zusammensetzen und warum sie fair und
            nachhaltig sind.
          </p>
        </div>
      </section>

      {/* Preisübersicht */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-12">
          <div>
            <h2 className="text-2xl font-800 text-navy-900 mb-6">Preisübersicht</h2>
            <div className="overflow-hidden rounded-2xl border border-[#EAECEF]">
              <table className="w-full text-left">
                <thead className="bg-surface">
                  <tr>
                    <th className="px-5 py-3 text-sm font-700 text-navy-900">Modell</th>
                    <th className="px-5 py-3 text-sm font-700 text-navy-900 text-right">
                      Preis pro Lektion (45 Min.)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {modelle.map(({ modell, preis }, i) => (
                    <tr key={modell} className={i > 0 ? "border-t border-[#EAECEF]" : ""}>
                      <td className="px-5 py-4 text-sm text-gray-700">{modell}</td>
                      <td className="px-5 py-4 text-sm font-700 text-navy-900 text-right">
                        {preis}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-500 mt-4 leading-relaxed">
              Die Pakete sind rabattiert, weil sie Verbindlichkeit schaffen und mir
              ermöglichen, den Unterricht verlässlich zu planen.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-800 text-navy-900">Warum eine Preispolitik?</h2>
            <p className="text-gray-600 leading-relaxed">
              Musikunterricht ist mehr als «Zeit gegen Geld». Hinter jeder Lektion
              stehen Vorbereitung, Erfahrung, Weiterbildung und ein persönliches
              Engagement für jede Schülerin und jeden Schüler. Damit ich meinen
              Unterricht langfristig, mit Freude und hoher Qualität anbieten kann,
              setze ich auf transparente und faire Preise.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-800 text-navy-900">
              Orientierung &amp; Qualitätsnachweis
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Ich orientiere mich an den Richtpreisen des SMPV (Schweizerischer
              Musikpädagogischer Verband) sowie an der Preisstruktur von Matchspace
              Music, wo ich den kompletten Qualifizierungsprozess durchlaufen habe.
              Mit über 14 Jahren Spielerfahrung, pädagogischem Interesse und
              kontinuierlicher Weiterbildung ergibt sich ein Preis, der Qualität,
              Zeitaufwand und Professionalität widerspiegelt.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-800 text-navy-900">Warum keine Billigstpreise?</h2>
            <p className="text-gray-600 leading-relaxed">
              In meinen zwei Jahren Unterrichtserfahrung habe ich gemerkt, dass manche
              einfach einen sehr günstigen Lehrer suchen, keine Verbindlichkeit zeigen
              und trotzdem hohes Engagement erwarten. Mein Ziel ist es, ein Umfeld zu
              schaffen, in dem sich beide Seiten wertschätzen und bewusst sind, was sie
              wollen. Wer nur mal «ausprobieren» will, ohne zu üben, ist bei mir nicht
              richtig – ich setze auf nachhaltige Entwicklung und Freude am Spielen.
            </p>
          </div>

          {/* Wegvergütung */}
          <div className="bg-surface rounded-2xl p-6 border border-[#EAECEF] space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-navy-50 text-navy-900 flex items-center justify-center">
                <Car className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-800 text-navy-900">Wegvergütung</h2>
            </div>
            <p className="text-gray-600 leading-relaxed text-sm">
              Weil ich Hausbesuche anbiete, geht einiges an Zeit für den Weg drauf.
              Innerhalb eines Umkreises von 5 Kilometern rund um mein Zuhause fallen
              keine Wegkosten an. Ab 5 km berechne ich pro angefangene 5 Kilometer
              zusätzlich CHF 5.–. So vermeide ich es, mehr Zeit mit Anfahrten zu
              verbringen als mit dem Unterrichten.
            </p>
          </div>

          {/* Was du bekommst */}
          <div>
            <h2 className="text-2xl font-800 text-navy-900 mb-6">Was du bekommst</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {leistungen.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 bg-white rounded-xl p-4 border border-[#EAECEF]"
                >
                  <Check className="w-4 h-4 text-navy-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Preisrechner */}
      <Preisrechner />

      {/* CTA */}
      <section className="bg-navy-900 py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl font-800 text-white">Unverbindlich ausprobieren?</h2>
          <p className="text-white/70">
            Die Probelektion ist kostenlos – lerne mich und meinen Unterricht in Ruhe
            kennen.
          </p>
          <Link href="/probelektion">
            <Button size="lg" className="bg-white text-navy-900 hover:bg-gray-100 font-700">
              Jetzt Probelektion buchen
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
