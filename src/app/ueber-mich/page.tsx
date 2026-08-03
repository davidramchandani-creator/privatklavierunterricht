import { Metadata } from "next";
import { Music, Users, Heart, CheckCircle2, Star } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Über mich – David Ramchandani | Privatklavierunterricht",
  description:
    "Erfahre mehr über David Ramchandani – Klavierunterricht in Neftenbach und Umgebung. Ohne Noten, individuell und praxisnah.",
};

const stationen = [
  {
    year: "Start",
    title: "Musikschule",
    desc: "Beginn des eigenen Klavierunterrichts – der erste Schritt in die Welt der Musik.",
  },
  {
    year: "2016–2020",
    title: "Band «High Five»",
    desc: "Erste Band-Erfahrung, regelmässige Proben und kleinere Auftritte mit der Band «High Five».",
  },
  {
    year: "2018–2020",
    title: "Soloauftritte",
    desc: "Individuelle Gigs u. a. in der Esse Musicbar Winterthur und im Moods in Zürich.",
  },
  {
    year: "2020",
    title: "Resonanzband",
    desc: "Mitglied der Resonanzband – inklusive Auftritt an den Musikfestwochen Winterthur.",
  },
  {
    year: "Anfang 2024",
    title: "Beginn zu unterrichten",
    desc: "Start eigener Klavierunterrichtsstunden – individuell, praxisnah und mit Begeisterung.",
  },
  {
    year: "Geplant 2027",
    title: "PH Studium",
    desc: "Start des Pädagogikstudiums an der PH Zürich – um Musik auch beruflich weiterzugeben.",
  },
];

const werte = [
  {
    icon: <Music className="w-5 h-5" />,
    title: "Ohne Noten",
    desc: "Wir spielen nach Akkorden, Gehör und Gefühl – keine trockene Theorie.",
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: "Individuell angepasst",
    desc: "Jede Stunde richtet sich nach deinem Tempo und deinen Interessen.",
  },
  {
    icon: <Heart className="w-5 h-5" />,
    title: "Direkt ans Instrument",
    desc: "Lernen durch Spielen – vom ersten Ton an.",
  },
];

/** Echte Schülerstimmen von der bisherigen Website. */
const stimmen = [
  {
    name: "Jan",
    text: "Perfekt! David ist ein sehr engagierter Klavierlehrer. Er unterrichtet meine zwei Kinder seit gut einem halben Jahr wöchentlich. Die Kinder fühlen sich super wohl mit ihm, haben Freude am Klavier spielen und machen tolle Fortschritte. David ist professionell, kommuniziert super und er ist sehr zuverlässig. Wir können ihn von Herzen weiterempfehlen :).",
  },
  {
    name: "Pierre",
    text: "Ich gehe zu ihm in die Stunden was ich keinen Moment bereue. Er hat eine sehr angenehme Art und Weise mir genau da zu helfen wo ich seine Hilfe benötige. Sehr vertrauenswürdige Lektionen auf schon fast kollegialer Basis, was ich enorm schätze. Toller Prof!",
  },
  {
    name: "Julian",
    text: "David spielt schon seit Kindheit Klavier und ich bin jedes mal überrascht wenn ich ihn spielen höre wie exakt und präzise er die Töne spielt. Er ist ein sehr geduldiger Mensch und kann einem sehr viel beibringen auf dem Klavier. Mit David hat man einen sehr guten, jungen Klavierlehrer der professionell und auf moderne Art und Weise Klavierunterricht erteilt.",
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
              16 Jahre Klaviererfahrung
            </div>
            <h1 className="text-4xl sm:text-5xl font-800 leading-tight">
              Hallo, ich bin <span className="italic">David</span>.
            </h1>
            <p className="text-white/70 text-lg leading-relaxed">
              Ich unterrichte Klavier mit Leidenschaft – nicht nach Noten, sondern nach Gefühl. Ob du Anfänger bist oder wieder einsteigen möchtest, bei mir zählt nicht die Perfektion, sondern der Spass am Spielen.
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
            { value: "16", label: "Jahre Klaviererfahrung" },
            { value: "5.0★", label: "aus 4 Bewertungen" },
            { value: "45 Min", label: "pro Lektion" },
            { value: "100%", label: "Unterricht bei dir zuhause" },
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
            <h2 className="text-2xl font-800 text-navy-900 mb-4">Warum ich unterrichte</h2>
            <div className="prose prose-gray max-w-none space-y-4 text-gray-600 leading-relaxed">
              <p>
                Ich liebe es, zu unterrichten. Jede*r Schüler*in bringt eine eigene
                Geschichte mit – und genau das macht den Unterricht so spannend.
                Mein Ziel ist es, dir zu zeigen, wie du dich am Klavier ausdrücken
                kannst. Ohne Druck, ohne Theorie-Marathon – sondern mit Freude.
              </p>
              <p>
                Seit meinem sechsten Lebensjahr begleitet mich das Klavier. Ich habe
                eine klassische Ausbildung genossen, aber früh gemerkt: Wirklich
                berühren kann Musik nur, wenn man sie lebt – nicht nur liest. Deshalb
                unterrichte ich heute nach einem spielerischen und praxisnahen
                Konzept – ganz ohne Notenlesen.
              </p>
              <p>
                Mein Ansatz kombiniert Spass am Musizieren mit echtem Lernerfolg. Du
                spielst schon nach wenigen Minuten erste Melodien und Begleitungen.
                Jede Lektion ist individuell auf deine Ziele und dein Tempo
                zugeschnitten – ob Anfängerin oder Fortgeschrittener.
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
          <h2 className="text-2xl font-800 text-navy-900 mb-8 tracking-tight">Mein Unterrichtsstil</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              "Klavierunterricht für Anfängerinnen und Fortgeschrittene",
              "Spielen nach Akkorden, Gehör und Gefühl – ohne Notenlesen",
              "Moderne Songs, die du wirklich spielen willst",
              "Unterricht bei dir zuhause in Neftenbach und Umgebung",
              "Lektionen à 45 Minuten, flexibel planbar",
              "Einzellektion oder 10er- bzw. 20er-Paket",
              "Individuell auf dein Tempo und deine Ziele abgestimmt",
              "Kostenlose, unverbindliche Probelektion",
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

      {/* Schülerstimmen */}
      <section className="bg-surface py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-800 text-navy-900 mb-2">Das sagen Schüler/innen</h2>
          <p className="text-gray-500 text-sm mb-10">Echte Erfahrungen aus dem Unterricht</p>
          <div className="grid md:grid-cols-3 gap-4">
            {stimmen.map(({ name, text }) => (
              <figure
                key={name}
                className="bg-white rounded-2xl p-6 border border-[#EAECEF] flex flex-col gap-4"
              >
                <div className="flex gap-0.5" aria-label="5 von 5 Sternen">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="text-sm text-gray-600 leading-relaxed flex-1">
                  {text}
                </blockquote>
                <figcaption className="text-sm font-700 text-navy-900">{name}</figcaption>
              </figure>
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
