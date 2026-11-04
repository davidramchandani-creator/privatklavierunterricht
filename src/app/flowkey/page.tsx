import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Handshake, Music, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FLOWKEY } from "@/lib/flowkey";

export const metadata: Metadata = {
  alternates: { canonical: "/flowkey" },
  title: "Partnerschaft mit flowkey: Privatklavierunterricht David Ramchandani",
  description: `Ich bin Partner von flowkey. Mit dem Code ${FLOWKEY.code} bekommst du ${FLOWKEY.rabattProzent} % Rabatt auf jedes flowkey-Abo. Hier steht offen, was ich davon habe.`,
};

/**
 * Die Partnerseite für flowkey.
 *
 * Steht im Footer und wird von der Startseite verlinkt. Der wichtigste
 * Teil ist der Abschnitt „Transparenz“: dass David eine Provision und
 * einen Gratiszugang bekommt, steht dort ausdrücklich, nicht im
 * Kleingedruckten. Er empfiehlt die App auch Kindern, deren Eltern das
 * wissen sollen.
 *
 * Solange `FLOWKEY.aktiv` aus ist (Freigabe durch flowkey ausstehend),
 * gibt es die Seite nicht.
 */
export default function FlowkeyPage() {
  if (!FLOWKEY.aktiv) notFound();

  return (
    <main>
      <section className="bg-navy-900 pt-32 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-white space-y-4">
          <span className="inline-block text-xs font-600 uppercase tracking-widest text-white/60 border border-white/20 rounded-full px-3 py-1">
            Partnerschaft · Werbung
          </span>
          <h1 className="text-3xl sm:text-4xl font-800">Ich bin Partner von flowkey</h1>
          <p className="text-white/70 text-lg leading-relaxed">
            flowkey ist eine App zum Klavierlernen. Mit meinem Code bekommst du{" "}
            {FLOWKEY.rabattProzent} % Rabatt auf jedes flowkey-Abo.
          </p>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="bg-white rounded-2xl border border-[#EAECEF] shadow-sm p-6 sm:p-8 text-center space-y-3">
            <p className="text-sm font-600 text-gray-500">Dein Rabattcode</p>
            <p className="text-4xl font-800 tracking-wider text-navy-900">{FLOWKEY.code}</p>
            <p className="text-sm text-gray-500">
              {FLOWKEY.rabattProzent} % auf jedes flowkey-Abo. Den Code gibst du beim Kauf auf flowkey ein.
            </p>
            <a href={FLOWKEY.url} target="_blank" rel="noopener noreferrer sponsored">
              <Button className="mt-2 gap-2">
                Zu flowkey <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          </div>

          <Abschnitt icon={<Music className="w-5 h-5" />} titel="Was flowkey ist">
            <p>
              flowkey ist eine App, mit der du selbständig Klavier üben kannst: mit Kursen, Übungen und
              einer grossen Songbibliothek.
            </p>
            <p>
              Für meinen Unterricht brauchst du flowkey nicht. Die App ersetzt keine Lektion, sie kann
              aber eine Hilfe sein, um zwischen den Lektionen dranzubleiben. Ob sie zu dir passt, entscheidest
              du selbst.
            </p>
          </Abschnitt>

          <Abschnitt icon={<Handshake className="w-5 h-5" />} titel="Transparenz: Was ich davon habe">
            <p>
              Ich bin Teil des Partnerprogramms von flowkey. Wenn du ein Abo mit meinem Code{" "}
              <strong>{FLOWKEY.code}</strong> abschliesst, bekomme ich von flowkey eine Provision, auch bei
              Verlängerungen. Ausserdem stellt mir flowkey die App kostenlos zur Verfügung.
            </p>
            <p>
              Für dich wird es dadurch nicht teurer: Du zahlst mit dem Code {FLOWKEY.rabattProzent} % weniger
              als ohne. Am Preis meines Unterrichts ändert sich nichts, und niemand muss flowkey nutzen.
            </p>
          </Abschnitt>

          <Abschnitt icon={<ShieldCheck className="w-5 h-5" />} titel="Deine Daten">
            <p>
              Ich gebe keine Daten von dir an flowkey weiter. Den Code löst du selbst bei flowkey ein, und dein
              Abo läuft direkt über flowkey. Dafür gelten die Bedingungen und die Datenschutzerklärung von
              flowkey.
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

function Abschnitt({
  icon,
  titel,
  children,
}: {
  icon: React.ReactNode;
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-navy-50 text-navy-900 flex items-center justify-center">
          {icon}
        </span>
        <h2 className="text-xl font-800 text-navy-900">{titel}</h2>
      </div>
      <div className="text-gray-600 leading-relaxed space-y-3">{children}</div>
    </div>
  );
}
