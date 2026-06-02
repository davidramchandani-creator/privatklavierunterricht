import Link from "next/link";
import { Check, Lock, Unlock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const pakete = [
  {
    id: "einzellektion",
    name: "Einzellektion",
    preis: 105,
    preisAlt: null,
    rabatt: null,
    highlight: false,
    badge: null,
    login: false,
    features: [
      "Kein Login erforderlich",
      "Ideal zum Ausprobieren oder Auffrischen",
      "Einmalige, flexible Buchung",
      "Gezieltes Arbeiten an einem Thema",
      "Für spontane Termine ohne Verpflichtung",
    ],
    hinweis: "Ab 5 km ab Neftenbach fallen Wegkosten an.",
    cta: "Jetzt anfragen",
    href: "/#probelektion",
  },
  {
    id: "10er",
    name: "10er-Paket",
    preis: 90,
    preisAlt: 105,
    rabatt: 14,
    highlight: true,
    badge: "Beliebt",
    login: true,
    features: [
      "Login erforderlich",
      "10 Lektionen",
      "Zugang zum Schülerportal",
      "Ca. 5 Monate gültig",
      "Aufbau über mehrere Lektionen hinweg",
      "Regelmässige Zeitslots reservierbar",
      "Flexibel einsetzbar",
    ],
    hinweis: "Ab 5 km ab Neftenbach fallen Wegkosten an.",
    cta: "Jetzt anfragen",
    href: "/#probelektion",
  },
  {
    id: "20er",
    name: "20er-Paket",
    preis: 85,
    preisAlt: 105,
    rabatt: 19,
    highlight: false,
    badge: "Bestes Angebot",
    login: true,
    features: [
      "Login erforderlich",
      "20 Lektionen",
      "Zugang zum Schülerportal",
      "Ca. 10 Monate gültig",
      "Fester, flexibler Wochentermin",
      "Ideal für langfristiges Lernen",
      "Beste Planbarkeit für beide Seiten",
    ],
    hinweis: "Ab 5 km ab Neftenbach fallen Wegkosten an.",
    cta: "Jetzt anfragen",
    href: "/#probelektion",
  },
];

export default function Pakete() {
  return (
    <section id="angebote" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-[#C9A84C] font-600 text-sm uppercase tracking-widest mb-3">
            Angebote
          </p>
          <h2 className="text-3xl sm:text-4xl font-800 text-[#1C244B] mb-4">
            Wähle dein Paket
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Ob einmalig zum Reinschnuppern oder regelmässig für langfristigen
            Fortschritt – hier findest du das passende Angebot.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {pakete.map((paket) => (
            <div
              key={paket.id}
              className={`relative rounded-2xl border bg-white flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                paket.highlight
                  ? "border-[#1C244B] shadow-lg shadow-[#1C244B]/10 ring-1 ring-[#1C244B]"
                  : "border-gray-200 shadow-sm"
              }`}
            >
              {/* Highlight banner */}
              {paket.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-[#1C244B] text-white text-xs font-600 px-4 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3 fill-[#C9A84C] text-[#C9A84C]" />
                    Beliebt
                  </span>
                </div>
              )}

              <div className="p-6 flex flex-col flex-1">
                {/* Name + Badge */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-700 text-[#1C244B] text-lg">
                    {paket.name}
                  </h3>
                  {paket.badge && !paket.highlight && (
                    <Badge variant="gold" className="text-xs">
                      {paket.badge}
                    </Badge>
                  )}
                </div>

                {/* Preis */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-800 text-[#1C244B]">
                      {paket.preis}
                    </span>
                    <span className="text-gray-500 text-sm">
                      CHF / Lektion
                    </span>
                  </div>
                  {paket.preisAlt && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-400 line-through text-sm">
                        {paket.preisAlt} CHF
                      </span>
                      <span className="text-emerald-600 font-600 text-sm">
                        –{paket.rabatt}% Rabatt
                      </span>
                    </div>
                  )}
                </div>

                {/* Login-Hinweis */}
                <div
                  className={`flex items-center gap-2 text-sm mb-6 pb-6 border-b border-gray-100 ${
                    paket.login ? "text-[#C9A84C]" : "text-gray-500"
                  }`}
                >
                  {paket.login ? (
                    <Lock className="w-4 h-4 shrink-0" />
                  ) : (
                    <Unlock className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {paket.login ? "Login erforderlich" : "Kein Login nötig"}
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 flex-1 mb-8">
                  {paket.features.slice(1).map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#C9A84C] mt-0.5 shrink-0" />
                      <span className="text-gray-600 text-sm">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* Wegkosten Hinweis */}
                <p className="text-xs text-gray-400 mb-4">* {paket.hinweis}</p>

                {/* CTA */}
                <Link href={paket.href}>
                  <Button
                    className="w-full"
                    variant={paket.highlight ? "default" : "outline"}
                  >
                    {paket.cta}
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
