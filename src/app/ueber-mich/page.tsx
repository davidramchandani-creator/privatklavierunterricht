import { Metadata } from "next";
import { Music, Award, Users, Heart, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Über mich – David Ramchandani | Privatklavierunterricht",
  description:
    "Erfahre mehr über David Ramchandani – Klavierlehrer mit über 16 Jahren Erfahrung in Zürich. Dein persönlicher Musikunterricht.",
};

const stationen = [
  {
    year: "2008",
    title: "Beginn der Lehrtätigkeit",
    desc: "Erste Klavierstunden als Jugendlicher – und sofort Feuer gefangen.",
  },
  {
    year: "2012",
    title: "Musikhochschule",
    desc: "Vertieftes Studium klassischer Klaviertechnik und Musiktheorie.",
  },
  {
    year: "2015",
    title: "Erste eigene Schüler",
    desc: "Aufbau eines festen Schülerkreises mit Unterricht in Zürich.",
  },
  {
    year: "2020+",
    title: "Online & Präsenz",
    desc: "Flexibler Unterricht – vor Ort in deinem Zuhause oder online.",
  },
];

const werte = [
  {
    icon: <Heart className="w-5 h-5" />,
    title: "Leidenschaft",
    desc: "Musik ist mehr als Noten lesen – es geht ums Fühlen und Ausdrücken.",
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: "Individuell",
    desc: "Kein Schüler ist gleich. Ich passe mich deinem Tempo und Stil an.",
  },
  {
    icon: <Award className="w-5 h-5" />,
    title: "Qualität",
    desc: "Solide Technik als Fundament – damit du wirklich Fortschritte machst.",
  },
];

export default function UeberMichPage() {
  return (
    <main>
      {/* Hero */}
      <section className="bg-navy-900 pt-32 pb-20 px-4 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />
        <div className="max-w-5xl mx-auto relative grid md:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div className="text-white space-y-6">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-500 text-white/80">
              <Music className="w-4 h-4" />
              Klavierlehrer seit 2008
            </div>
            <h1 className="text-4xl sm:text-5xl font-800 leading-tight">
              Hallo, ich bin <span className="italic">David</span>.
            </h1>
            <p className="text-white/70 text-lg leading-relaxed">
              Ich bringe dir das Klavierspielen bei – egal ob du absolute Anfängerin oder fortgeschrittener Spieler bist. Mit Geduld, Humor und echter Leidenschaft.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link href="/probelektion">
                <Button size="lg" className="bg-white text-navy-900 hover:bg-gray-100 font-700">Probelektion anfragen</Button>
              </Link>
              <Link href="/#angebote">
                <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">
                  Angebote ansehen
                </Button>
              </Link>
            </div>
          </div>

          {/* Photo */}
          <div className="flex justify-center md:justify-end">
            <div className="relative w-72 h-80 md:w-80 md:h-96">
              <div className="absolute inset-0 rounded-3xl overflow-hidden bg-surface border border-white/10 shadow-2xl shadow-black/30">
                <Image
                  src="/david-ramchandani-portrait-720-762.jpg"
                  alt="David Ramchandani – Klavierlehrer"
                  fill
                  sizes="(max-width: 768px) 18rem, 20rem"
                  className="object-cover object-top"
                  priority
                />
              </div>
              {/* Badge */}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-lg px-4 py-3 text-navy-900">
                <p className="text-2xl font-800">16+</p>
                <p className="text-xs text-gray-500 font-500">Jahre Erfahrung</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b border-[#EAECEF] py-10">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: "16+", label: "Jahre Erfahrung" },
            { value: "200+", label: "Schülerinnen & Schüler" },
            { value: "5★", label: "Bewertung" },
            { value: "100%", label: "Persönlicher Unterricht" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-800 text-navy-900">{value}</p>
              <p className="text-sm text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Über mich Text */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h2 className="text-2xl font-800 text-navy-900 mb-4">Meine Geschichte</h2>
            <div className="prose prose-gray max-w-none space-y-4 text-gray-600 leading-relaxed">
              <p>
                Mit 12 Jahren habe ich das erste Mal auf einem alten Klavier gespielt – und seitdem nicht mehr aufgehört. Was als Hobby begann, ist heute mein Beruf und meine Leidenschaft.
              </p>
              <p>
                Ich unterrichte alle Altersgruppen: von kleinen Kindern ab 5 Jahren bis zu Erwachsenen, die den Traum vom Klavierspielen endlich verwirklichen möchten. Egal ob Klassik, Pop, Jazz oder einfach das Lieblingslied – bei mir darfst du spielen, was dich begeistert.
              </p>
              <p>
                Mein Unterricht findet bei dir zu Hause statt – bequem, ohne Fahrtwege, in deiner vertrauten Umgebung. So können wir uns ganz auf die Musik konzentrieren.
              </p>
            </div>
          </div>

          {/* Werte */}
          <div className="grid sm:grid-cols-3 gap-4 pt-4">
            {werte.map(({ icon, title, desc }) => (
              <div key={title} className="bg-surface rounded-2xl p-5 space-y-2 border border-[#EAECEF]">
                <div className="w-9 h-9 rounded-xl bg-navy-50 text-navy-900 flex items-center justify-center">
                  {icon}
                </div>
                <p className="font-700 text-navy-900 text-sm">{title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Was ich anbiete */}
      <section className="bg-surface py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-800 text-navy-900 mb-8 tracking-tight">Was ich anbiete</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "Klavierunterricht für Anfänger und Fortgeschrittene",
              "Kinder ab 5 Jahren, Jugendliche & Erwachsene",
              "Klassik, Pop, Jazz, Filmmusik – du wählst",
              "Unterricht bei dir zu Hause in Zürich",
              "Flexible Terminplanung rund um deinen Alltag",
              "Vorbereitung auf Prüfungen und Auftritte",
              "Musiktheorie & Notenlesen",
              "Online-Unterricht auf Wunsch",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 bg-white rounded-xl p-4 border border-[#EAECEF] hover:border-navy-900/20 hover:-translate-y-0.5 transition-all duration-200">
                <CheckCircle2 className="w-4 h-4 text-navy-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Werdegang / Timeline */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-800 text-navy-900 mb-10">Mein Weg</h2>
          <div className="relative pl-8 space-y-8">
            <div className="absolute left-3.5 top-2 bottom-2 w-px bg-gray-200" />
            {stationen.map(({ year, title, desc }) => (
              <div key={year} className="relative">
                <div className="absolute -left-[1.35rem] top-1 w-3 h-3 rounded-full bg-navy-900 border-2 border-white shadow-sm" />
                <span className="text-xs font-700 text-gray-400 uppercase tracking-widest">{year}</span>
                <h3 className="font-700 text-navy-900 mt-1">{title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy-900 py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl font-800 text-white">Bereit, anzufangen?</h2>
          <p className="text-white/70">
            Komm zur kostenlosen Probelektion und erlebe, wie viel Spass Klavierspielen machen kann.
          </p>
          <Link href="/probelektion">
            <Button size="lg" className="bg-white text-navy-900 hover:bg-gray-100 font-700">
              Jetzt Probelektion anfragen
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
