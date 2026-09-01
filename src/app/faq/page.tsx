import type { Metadata } from "next";
import Link from "next/link";
import { FAQ, faqJsonLd } from "@/lib/faq";

export const metadata: Metadata = {
  title: "Häufige Fragen zum Klavierunterricht",
  description:
    "Brauche ich ein eigenes Klavier? Muss ich Noten lesen können? Was kostet eine Lektion? Die Fragen, die vor der ersten Stunde am häufigsten kommen — offen beantwortet.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Häufige Fragen zum Klavierunterricht",
    description:
      "Klavier, Noten, Preise, Absagen: die Fragen vor der ersten Stunde.",
    url: "/faq",
  },
};

export default function FaqPage() {
  return (
    <>
      {/* Für Google, nicht für Menschen: Damit die Fragen direkt im
          Suchergebnis erscheinen können. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-800 text-navy-900">
            Häufige Fragen
          </h1>
          <p className="text-gray-600 mt-3 leading-relaxed">
            Was vor der ersten Stunde am häufigsten gefragt wird. Steht deine
            Frage nicht dabei,{" "}
            <Link
              href="/kontakt"
              className="underline font-600 text-navy-900 hover:opacity-80"
            >
              schreib mir
            </Link>
            .
          </p>

          <div className="mt-10 space-y-3">
            {FAQ.map((f) => (
              <details
                key={f.frage}
                className="group rounded-2xl border border-[#EAECEF] bg-white overflow-hidden"
              >
                <summary className="cursor-pointer select-none list-none px-5 py-4 flex items-center justify-between gap-4">
                  <span className="text-base font-600 text-navy-900">
                    {f.frage}
                  </span>
                  {/* Kein Symbol aus einer Bibliothek: Ein gedrehtes Pluszeichen
                      aus zwei Strichen kostet kein zusätzliches Kilobyte. */}
                  <span
                    aria-hidden
                    className="relative w-4 h-4 flex-shrink-0 text-gray-400"
                  >
                    <span className="absolute inset-x-0 top-1/2 h-[1.5px] bg-current -translate-y-1/2" />
                    <span className="absolute inset-y-0 left-1/2 w-[1.5px] bg-current -translate-x-1/2 transition-transform duration-200 group-open:rotate-90 group-open:opacity-0" />
                  </span>
                </summary>
                <p className="px-5 pb-4 text-gray-600 leading-relaxed">
                  {f.antwort}
                </p>
              </details>
            ))}
          </div>

          <div className="mt-12 rounded-2xl bg-surface border border-[#E3E7EE] p-6 text-center">
            <p className="text-navy-900 font-600">
              Am schnellsten beantwortet sich alles beim Spielen.
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Die Probelektion ist kostenlos und verpflichtet zu nichts.
            </p>
            <Link
              href="/probelektion"
              className="press inline-flex items-center justify-center gap-2 bg-navy-900 text-white text-sm font-600 px-5 py-3 rounded-xl hover:bg-[#2A3563] transition-colors mt-4"
            >
              Probelektion buchen
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
