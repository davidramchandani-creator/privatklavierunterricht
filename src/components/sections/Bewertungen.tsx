import Link from "next/link";
import { Star, Quote } from "lucide-react";
import AbschnittsKopf from "@/components/AbschnittsKopf";
import Schuelervideos from "@/components/sections/Schuelervideos";
import { ladeBewertungen } from "@/lib/bewertungen";


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

export default async function Bewertungen() {
  const { liste, anzahl, schnitt } = await ladeBewertungen();

  // Ohne freigegebene Bewertungen keinen leeren Abschnitt mit der
  // Ueberschrift "Was Schueler sagen" stehen lassen. Die Videos bleiben.
  if (anzahl === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <AbschnittsKopf kicker="Stimmen" titel="Was Schüler sagen" className="mb-6" />

        {/*
          Die Sterne sind dekorativ (aria-hidden); die Wertung steht als Text
          daneben. Ein Screenreader liest sonst fünfmal „Stern" und nie die
          Zahl, um die es geht.
        */}
        <div className="flex items-center gap-2 mb-12">
          <div className="flex gap-0.5" aria-hidden>
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <span className="font-700 text-navy-900">{schnitt}</span>
          {/*
            Gezaehlt werden alle, auch die zwei, die damals nur fuenf Sterne
            gegeben und nichts geschrieben haben. Gezeigt werden nur die mit
            Text: Eine Karte mit leerem Zitat sieht nach Fehler aus.
          */}
          <span className="text-gray-500 text-sm">
            aus {anzahl} Bewertungen
          </span>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {liste.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-[#EAECEF] p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <Quote className="w-8 h-8 text-gray-200 mb-3" />
              <Sterne count={b.sterne} />
              <p className="text-gray-600 mt-3 mb-4 text-sm leading-relaxed">
                  &ldquo;{b.textKurz ?? b.text}&rdquo;
                </p>
              <p className="text-xs font-600 text-gray-400">{b.name}</p>
            </div>
          ))}
        </div>

        {/*
          Videos nach den Zitaten: Wer liest, ist schneller fertig als wer
          zusieht. Zuerst das schnell Erfassbare, dann das, wofür man sich
          Zeit nimmt.
        */}
        <Schuelervideos />

        {/*
          Nach dem sozialen Beleg. Wer bis hierher gelesen hat, glaubt, dass
          es funktioniert, und hätte bis zum Seitenende keinen Weg, etwas
          daraus zu machen.
        */}
        <p className="text-center text-gray-500 mt-10">
          Klingt gut?{" "}
          <Link
            href="/probelektion"
            className="text-navy-900 font-700 underline decoration-navy-200 hover:decoration-navy-900 underline-offset-4 transition-colors"
          >
            Probelektion buchen
          </Link>, unverbindlich.
        </p>
      </div>
    </section>
  );
}
