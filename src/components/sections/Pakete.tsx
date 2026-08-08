import Link from "next/link";
import { Check, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const pakete = [
  {
    id: "einzellektion",
    name: "Einzellektion",
    preis: 85,
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
    href: "/probelektion",
  },
  {
    id: "10er",
    name: "10er-Paket",
    preis: 70,
    preisAlt: 85,
    rabatt: 18,
    highlight: true,
    badge: "Beliebt",
    login: true,
    features: [
      "Login erforderlich",
      "10 Lektionen",
      "Zugang zum Schülerportal",
      "4 Monate gültig",
      "Auf Wunsch in 4 Monatsraten",
      "Aufbau über mehrere Lektionen hinweg",
      "Regelmässige Zeitslots reservierbar",
      "Flexibel einsetzbar",
    ],
    hinweis: "Ab 5 km ab Neftenbach fallen Wegkosten an.",
    cta: "Jetzt anfragen",
    href: "/probelektion",
  },
  {
    id: "20er",
    name: "20er-Paket",
    preis: 65,
    preisAlt: 85,
    rabatt: 24,
    highlight: false,
    badge: "Bestes Angebot",
    login: true,
    features: [
      "Login erforderlich",
      "20 Lektionen",
      "Zugang zum Schülerportal",
      "8 Monate gültig",
      "Auf Wunsch in 8 Monatsraten",
      "Fester, flexibler Wochentermin",
      "Ideal für langfristiges Lernen",
      "Beste Planbarkeit für beide Seiten",
    ],
    hinweis: "Ab 5 km ab Neftenbach fallen Wegkosten an.",
    cta: "Jetzt anfragen",
    href: "/probelektion",
  },
];

export default function Pakete() {
  return (
    <section id="angebote" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-gray-400 font-600 text-xs uppercase tracking-widest mb-3">
            Angebote
          </p>
          <h2 className="text-3xl sm:text-4xl font-800 text-navy-900 mb-4 tracking-tight">
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
                  ? "border-navy-900 shadow-lg shadow-navy-900/10 ring-1 ring-navy-900"
                  : "border-gray-100 shadow-sm"
              }`}
            >
              {/* Highlight banner */}
              {paket.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-navy-900 text-white text-xs font-600 px-4 py-1 rounded-full">
                    Beliebt
                  </span>
                </div>
              )}

              <div className="p-6 flex flex-col flex-1">
                {/* Name + Badge */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-700 text-navy-900 text-lg">
                    {paket.name}
                  </h3>
                  {paket.badge && !paket.highlight && (
                    <Badge variant="default" className="text-xs">
                      {paket.badge}
                    </Badge>
                  )}
                </div>

                {/* Preis */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-800 text-navy-900">
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
                      <span className="text-status-paid font-600 text-sm">
                        –{paket.rabatt}% Rabatt
                      </span>
                    </div>
                  )}
                </div>

                {/* Login-Hinweis */}
                <div
                  className={`flex items-center gap-2 text-sm mb-6 pb-6 border-b border-gray-100 ${
                    paket.login ? "text-gray-500" : "text-gray-500"
                  }`}
                >
                  {paket.login ? (
                    <Lock className="w-4 h-4 shrink-0 text-gray-400" />
                  ) : (
                    <Unlock className="w-4 h-4 shrink-0 text-gray-400" />
                  )}
                  <span>
                    {paket.login ? "Login erforderlich" : "Kein Login nötig"}
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 flex-1 mb-8">
                  {paket.features.slice(1).map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-navy-600 mt-0.5 shrink-0" />
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
