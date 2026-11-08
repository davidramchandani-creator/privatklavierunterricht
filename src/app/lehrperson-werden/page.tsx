import type { Metadata } from "next";
import { Banknote, CalendarHeart, Handshake, HeartHandshake, MapPin, Smartphone } from "lucide-react";
import { ANGEBOT } from "@/lib/bewerbung";
import BewerbungSchritte from "./BewerbungSchritte";

export const metadata: Metadata = {
  alternates: { canonical: "/lehrperson-werden" },
  title: "Lehrperson werden: Klavier unterrichten in der Region Winterthur",
  description: `Unterrichte Klavier mit mir in der Region Winterthur. CHF ${ANGEBOT.lohn} pro Lektion inklusive Ferienentschädigung, die Schüler vermittle ich dir. Bewerbung in 5 Minuten.`,
};

const VORTEILE = [
  {
    icon: Banknote,
    titel: `CHF ${ANGEBOT.lohn} pro Lektion`,
    text: `Pro Lektion à ${ANGEBOT.lektionMinuten} Minuten, inklusive Ferienentschädigung. Angestellt im Stundenlohn, die Sozialversicherungen rechne ich ab. Bei Hausbesuchen kommen Fahrspesen dazu.`,
  },
  {
    icon: Handshake,
    titel: "Du unterrichtest, ich mache den Rest",
    text: "Ich finde die Schüler, kläre Preise, Verträge, Rechnungen und Zahlungen. Keine Akquise, kein Inkasso, kein Papierkram.",
  },
  {
    icon: CalendarHeart,
    titel: "Passt neben Studium und Job",
    text: "Du sagst mir, wann du Zeit hast, und ich frage dich für passende Schüler an. Du entscheidest, ob du zusagst.",
  },
  {
    icon: Smartphone,
    titel: "Eigenes Portal",
    text: "Deine Termine, deine Schüler und Notizen zu jeder Lektion an einem Ort, auch auf dem Handy.",
  },
  {
    icon: HeartHandshake,
    titel: "Beziehung vor Programm",
    text: "Bei uns zählt der Mensch am Klavier. Noten ohne Zwang, Musik verstehen über Muster, Gehör und Abschnitte.",
  },
  {
    icon: MapPin,
    titel: `Region ${ANGEBOT.region}`,
    text: "Hausbesuche bei den Schülern oder Unterricht bei dir zu Hause, ganz wie es für dich passt.",
  },
];

const PROFIL = [
  "Du spielst gut Klavier und hast Freude daran, das weiterzugeben. Ein Diplom brauchst du nicht.",
  "Unterrichtserfahrung ist ein Plus, aber keine Bedingung.",
  "Du studierst Musik oder an einer PH? Herzlich willkommen.",
  `Du bist mobil in der Region ${ANGEBOT.region}, mit ÖV, Velo oder Auto.`,
];

const ABLAUF = [
  { titel: "Bewerbung", text: "In vier kurzen Schritten, etwa 5 Minuten. Ohne Lebenslauf." },
  { titel: "Gespräch", text: "Wir lernen uns in 20 Minuten kennen, per Telefon oder Video." },
  { titel: "Probelektion", text: "Du zeigst mir, wie du unterrichtest, ganz entspannt." },
  { titel: "Start", text: `Ab ${ANGEBOT.startText} mit deinen ersten Schülern.` },
];

/**
 * „Lehrperson werden“ (David, 8. November 2026).
 *
 * Soll Bewerbungen leicht machen und David Aufwand sparen: Der Lohn steht
 * offen da, die Bewerbung fragt in Schritten genau das ab, was er für
 * die Zuteilung braucht (Zeiten, Orte, Mobilität, Altersgruppen), und im
 * Admin läuft alles durch Stufen mit vorbereiteten Mails.
 */
export default function LehrpersonWerdenPage() {
  return (
    <main>
      <section className="bg-navy-900 pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-gradient-to-br from-navy-600/40 to-transparent blur-3xl pointer-events-none" />
        <div className="max-w-3xl mx-auto text-white space-y-5 relative">
          <span className="inline-block text-xs font-600 uppercase tracking-widest text-white/60 border border-white/20 rounded-full px-3 py-1">
            Ab {ANGEBOT.startText}
          </span>
          <h1 className="text-4xl sm:text-5xl font-800 leading-tight">Unterrichte Klavier mit mir.</h1>
          <p className="text-white/70 text-lg leading-relaxed max-w-2xl">
            Ich suche Menschen, die Klavier lieben und gern mit anderen Musik machen. Du unterrichtest, ich
            kümmere mich um alles andere.
          </p>
          <a
            href="#bewerbung"
            className="press inline-flex items-center gap-2 bg-white text-navy-900 font-700 rounded-xl px-6 py-3 hover:-translate-y-0.5 transition-transform"
          >
            Jetzt bewerben, in 5 Minuten
          </a>
        </div>
      </section>

      <section className="py-16 px-4 bg-surface">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {VORTEILE.map(({ icon: Icon, titel, text }) => (
            <div
              key={titel}
              className="group bg-white rounded-2xl border border-[#EAECEF] p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="w-11 h-11 rounded-xl bg-navy-50 flex items-center justify-center mb-4 group-hover:bg-navy-900 transition-colors">
                <Icon className="w-5 h-5 text-navy-900 group-hover:text-white transition-colors" />
              </div>
              <h2 className="font-800 text-navy-900 mb-1.5">{titel}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          <div className="space-y-4">
            <h2 className="text-2xl font-800 text-navy-900">Was du mitbringst</h2>
            <ul className="space-y-3">
              {PROFIL.map((p) => (
                <li key={p} className="flex gap-3 text-gray-600 leading-relaxed">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-navy-600 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl font-800 text-navy-900">So geht es weiter</h2>
            <ol className="space-y-4">
              {ABLAUF.map((a, i) => (
                <li key={a.titel} className="flex gap-4">
                  <span className="w-8 h-8 rounded-full bg-navy-900 text-white text-sm font-700 flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-700 text-navy-900">{a.titel}</p>
                    <p className="text-sm text-gray-600">{a.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="bewerbung" className="py-16 px-4 bg-surface scroll-mt-20">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-[#EAECEF] shadow-sm p-6 sm:p-10">
          <BewerbungSchritte />
        </div>
      </section>
    </main>
  );
}
