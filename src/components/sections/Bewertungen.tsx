import Link from "next/link";
import { Star, Quote } from "lucide-react";

interface Bewertung {
  id: string;
  sterne: number;
  text: string;
  name: string;
}

const BEWERTUNGEN: Bewertung[] = [
  {
    id: "flurina",
    sterne: 5,
    text: "Diego ist sehr motiviert und happy!",
    name: "Flurina",
  },
  {
    id: "marina",
    sterne: 5,
    text: "Wir haben Spass zusammen zu spielen und zu lernen.",
    name: "Marina",
  },
  {
    id: "jan",
    sterne: 5,
    text: "David ist ein sehr engagierter Klavierlehrer. Die Kinder fühlen sich super wohl mit ihm, haben Freude am Klavier spielen und machen tolle Fortschritte. Wir können ihn von Herzen weiterempfehlen.",
    name: "Jan",
  },
  {
    id: "pierre",
    sterne: 5,
    text: "Er hat eine sehr angenehme Art und Weise mir genau da zu helfen wo ich seine Hilfe benötige. Sehr vertrauenswürdige Lektionen auf schon fast kollegialer Basis. Toller Prof!",
    name: "Pierre",
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
              ? "fill-amber-400 text-amber-400"
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
          <p className="text-gray-400 font-600 text-xs uppercase tracking-widest mb-3">
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
                  className="w-5 h-5 fill-amber-400 text-amber-400"
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
              <Quote className="w-8 h-8 text-gray-200 mb-3" />
              <Sterne count={b.sterne} />
              <p className="text-gray-600 mt-3 mb-4 text-sm leading-relaxed">
                  &ldquo;{b.text}&rdquo;
                </p>
              <p className="text-xs font-600 text-gray-400">{b.name}</p>
            </div>
          ))}
        </div>

        {/*
          Nach dem sozialen Beleg. Wer bis hierher gelesen hat, glaubt, dass
          es funktioniert — und hätte bis zum Seitenende keinen Weg, etwas
          daraus zu machen.
        */}
        <p className="text-center text-gray-500 mt-10">
          Klingt gut?{" "}
          <Link
            href="/probelektion"
            className="text-navy-900 font-700 underline decoration-navy-200 hover:decoration-navy-900 underline-offset-4 transition-colors"
          >
            Probelektion buchen
          </Link>{" "}
          — unverbindlich.
        </p>
      </div>
    </section>
  );
}
