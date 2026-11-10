import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Handshake, Headphones, Layers, Library, Music, Repeat, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import FlowkeyLogo from "@/components/FlowkeyLogo";
import { FLOWKEY, FLOWKEY_FUNKTIONEN } from "@/lib/flowkey";

export const metadata: Metadata = {
  alternates: { canonical: "/flowkey" },
  title: "Partnerschaft mit flowkey: Privatklavierunterricht David Ramchandani",
  description: `Ich bin Partner von flowkey. Mit dem Code ${FLOWKEY.code} bekommst du ${FLOWKEY.rabattProzent} % Rabatt auf jedes flowkey-Abo. Hier steht offen, was ich davon habe.`,
  // Bis flowkey die Seite freigegeben hat: erreichbar für die Freigabe,
  // aber nicht in Suchmaschinen.
  robots: FLOWKEY.aktiv ? undefined : { index: false, follow: false },
};

const ICONS = [Library, Headphones, Repeat, Music, Layers];

/**
 * Die Partnerseite für flowkey.
 *
 * Der wichtigste Teil ist „Transparenz“: dass David eine Provision und
 * einen Gratiszugang bekommt, steht ausdrücklich da. Er empfiehlt die App
 * auch Kindern, deren Eltern das wissen sollen.
 *
 * Solange `FLOWKEY.aktiv` aus ist, ist die Seite nicht verlinkt und nicht
 * in Suchmaschinen; David kann den Link aber an flowkey zur Freigabe
 * schicken (Vertrag 4.2).
 */
export default function FlowkeyPage() {
  return (
    <main>
      <section className="bg-navy-900 pt-28 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-white space-y-5">
          <span className="inline-block text-xs font-600 uppercase tracking-widest text-white/60 border border-white/20 rounded-full px-3 py-1">
            Partnerschaft · Werbung
          </span>
          <div className="-ml-4">
            <FlowkeyLogo hell hoehe={48} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-800">Üben zwischen den Lektionen, mit 25 % Rabatt</h1>
          <p className="text-white/70 text-lg leading-relaxed">
            Ich bin Partner von flowkey, einer App zum Klavierlernen. Mit meinem Code bekommst du{" "}
            {FLOWKEY.rabattProzent} % Rabatt auf jedes flowkey-Abo.
          </p>
        </div>
      </section>

      <section className="py-16 px-4 bg-surface">
        <div className="max-w-4xl mx-auto space-y-14">
          <div className="bg-white rounded-2xl border border-[#EAECEF] shadow-sm p-6 sm:p-10 text-center space-y-3 max-w-xl mx-auto">
            <p className="text-sm font-600 text-gray-500">Dein Rabattcode</p>
            <p className="text-4xl sm:text-5xl font-800 tracking-wider" style={{ color: FLOWKEY.orange }}>
              {FLOWKEY.code}
            </p>
            <p className="text-sm text-gray-500">
              {FLOWKEY.rabattProzent} % auf jedes flowkey-Abo. Den Code gibst du beim Kauf bei flowkey ein.
            </p>
            <a href={FLOWKEY.url} target="_blank" rel="noopener noreferrer sponsored" className="inline-block pt-2">
              <Button className="gap-2">
                Zu flowkey <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          </div>

          <div className="space-y-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-800 text-navy-900">Was flowkey kann</h2>
              <p className="text-gray-600 mt-2 leading-relaxed">
                flowkey ist eine App, mit der du selbständig Klavier übst: auf dem Handy, Tablet oder Computer,
                mit deinem Klavier oder E-Piano.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FLOWKEY_FUNKTIONEN.map((f, i) => {
                const Icon = ICONS[i] ?? Music;
                return (
                  <div
                    key={f.titel}
                    className="bg-white rounded-2xl border border-[#EAECEF] p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#FFF3E6" }}>
                      <Icon className="w-5 h-5" style={{ color: FLOWKEY.orange }} />
                    </div>
                    <h3 className="font-800 text-navy-900 mb-1">{f.titel}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{f.text}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <Abschnitt icon={<Music className="w-5 h-5" />} titel="Wie flowkey zu meinem Unterricht passt">
            <p>
              Im Unterricht arbeiten wir mit Abschnitten, Mustern und dem Gehör. Noten setze ich dort ein, wo sie
              dir helfen, mit guten Medien und Apps, und flowkey ist eine davon: Du kannst einen Abschnitt
              langsam und in der Schlaufe üben, jede Hand einzeln, und siehst Hände, Tasten und Noten zugleich.
            </p>
            <p>
              Für meinen Unterricht brauchst du flowkey nicht. Die App ersetzt keine Lektion, sie kann aber eine
              Hilfe sein, um zwischen den Lektionen dranzubleiben. Ob sie zu dir passt, entscheidest du selbst.
            </p>
          </Abschnitt>

          <Abschnitt icon={<Handshake className="w-5 h-5" />} titel="Transparenz: Was ich davon habe">
            <p>
              Ich bin Teil des Partnerprogramms von flowkey. Wenn du ein Abo mit meinem Code{" "}
              <strong>{FLOWKEY.code}</strong> abschliesst, bekomme ich von flowkey eine Provision, auch bei
              Verlängerungen. Ausserdem stellt mir flowkey die App kostenlos zur Verfügung.
            </p>
            <p>
              Für dich wird es dadurch nicht teurer: Du zahlst mit dem Code {FLOWKEY.rabattProzent} % weniger als
              ohne. Am Preis meines Unterrichts ändert sich nichts, und niemand muss flowkey nutzen.
            </p>
          </Abschnitt>

          <Abschnitt icon={<ShieldCheck className="w-5 h-5" />} titel="Deine Daten">
            <p>
              Ich gebe keine Daten von dir an flowkey weiter. Den Code löst du selbst bei flowkey ein, und dein Abo
              läuft direkt über flowkey. Dafür gelten die Bedingungen und die Datenschutzerklärung von flowkey.
            </p>
          </Abschnitt>

          <p className="text-sm text-gray-500">
            Fragen dazu?{" "}
            <Link href="/kontakt" className="font-600 text-navy-900 underline underline-offset-4">
              Schreib mir
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}

function Abschnitt({ icon, titel, children }: { icon: React.ReactNode; titel: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 max-w-3xl">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-navy-50 text-navy-900 flex items-center justify-center">{icon}</span>
        <h2 className="text-xl font-800 text-navy-900">{titel}</h2>
      </div>
      <div className="text-gray-600 leading-relaxed space-y-3">{children}</div>
    </div>
  );
}
