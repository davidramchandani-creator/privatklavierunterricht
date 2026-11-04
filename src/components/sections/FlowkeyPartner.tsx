import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FLOWKEY } from "@/lib/flowkey";

/**
 * Hinweis auf die Partnerschaft mit flowkey, auf der Startseite.
 *
 * Bewusst als „Partnerschaft · Werbung“ gekennzeichnet und mit dem Satz,
 * dass David eine Provision bekommt. Wer mehr wissen will, liest es auf
 * der Partnerseite.
 *
 * Ohne Logo: Logo und Markenmaterial darf David nur nach Absprache mit
 * flowkey verwenden (Vertrag 4.2). Ausgeschaltet, solange `FLOWKEY.aktiv`
 * nicht gesetzt ist.
 */
export default function FlowkeyPartner() {
  if (!FLOWKEY.aktiv) return null;

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#EAECEF] bg-surface p-6 sm:p-8 flex flex-col md:flex-row md:items-center gap-6 justify-between transition-transform hover:-translate-y-0.5">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-block text-xs font-600 uppercase tracking-widest text-gray-500">
              Partnerschaft · Werbung
            </span>
            <h2 className="text-2xl font-800 text-navy-900">
              Üben zwischen den Lektionen: {FLOWKEY.rabattProzent} % Rabatt auf flowkey
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Ich bin Partner von flowkey, einer App zum Klavierlernen. Mit dem Code{" "}
              <strong className="text-navy-900">{FLOWKEY.code}</strong> bekommst du {FLOWKEY.rabattProzent} %
              auf jedes Abo. Ich erhalte dafür eine Provision, für dich wird es günstiger.
            </p>
          </div>
          <Link
            href="/flowkey"
            className="press inline-flex items-center gap-2 text-sm font-600 text-navy-900 bg-white border border-[#EAECEF] rounded-lg px-4 py-2.5 hover:border-navy-900 transition-colors whitespace-nowrap"
          >
            Mehr dazu <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
