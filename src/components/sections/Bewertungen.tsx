import { Star, Quote } from "lucide-react";

interface Bewertung {
  id: string;
  sterne: number;
  text: string;
  name: string;
}

const BEWERTUNGEN: Bewertung[] = [
  {
    id: "p1",
    sterne: 5,
    text: "David ist ein unglaublicher Lehrer! Nach nur 3 Monaten kann ich bereits meine Lieblingslieder spielen. Sein Unterricht ist so motivierend.",
    name: "Julia M.",
  },
  {
    id: "p2",
    sterne: 5,
    text: "Endlich Klavierunterricht ohne trockene Theorie. David passt sich genau meinem Tempo an und macht den Unterricht immer spannend.",
    name: "Thomas K.",
  },
  {
    id: "p3",
    sterne: 5,
    text: "Als kompletter Anfänger hatte ich Bedenken, aber David hat mich sofort abgeholt. Sehr empfehlenswert!",
    name: "Anonymer Schüler",
  },
];

function Sterne({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i <= count
              ? "fill-gold-500 text-gold-500"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

export default function Bewertungen() {
  const anzeigen = BEWERTUNGEN;

  return (
    <section className="py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-gold-600 font-600 text-sm uppercase tracking-widest mb-3">
            Stimmen
          </p>
          <h2 className="text-3xl sm:text-4xl font-800 text-navy-900 mb-4 tracking-tight">
            Was Schüler sagen
          </h2>
          <div className="flex items-center justify-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className="w-5 h-5 fill-gold-500 text-gold-500"
                />
              ))}
            </div>
            <span className="font-700 text-navy-900">5.0</span>
            <span className="text-gray-500 text-sm">
              · {anzeigen.length} Bewertungen
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {anzeigen.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-[#EAECEF] p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <Quote className="w-8 h-8 text-gold-500/30 mb-3" />
              <Sterne count={b.sterne} />
              <p className="text-gray-600 mt-3 mb-4 text-sm leading-relaxed">
                  &ldquo;{b.text}&rdquo;
                </p>
              <p className="text-xs font-600 text-gray-400">{b.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
