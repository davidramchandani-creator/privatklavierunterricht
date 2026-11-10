import Link from "next/link";
import { ArrowRight } from "lucide-react";
import FlowkeyLogo from "@/components/FlowkeyLogo";
import FlowkeyCode from "@/components/FlowkeyCode";
import { FLOWKEY } from "@/lib/flowkey";

/**
 * Hinweis auf die Partnerschaft mit flowkey, auf der Startseite.
 *
 * Gekennzeichnet als „Partnerschaft · Werbung“, mit dem Satz, dass David
 * eine Provision bekommt. Orange Logo auf hellem Grund, mit Freiraum, nie
 * im Satz (Brand Guidelines).
 */
export default function FlowkeyPartner() {
  if (!FLOWKEY.aktiv) return null;

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="relative overflow-hidden rounded-3xl border border-[#F5DCC0] p-6 sm:p-10 grid md:grid-cols-[auto_1fr_auto] gap-8 items-center transition-transform hover:-translate-y-0.5"
          style={{ background: "linear-gradient(120deg, #FFFFFF 0%, #FFF3E6 100%)" }}
        >
          <div className="bg-white rounded-2xl border border-[#F5DCC0] justify-self-start shadow-sm">
            <FlowkeyLogo hoehe={44} />
          </div>
          <div className="space-y-2">
            <span className="inline-block text-xs font-600 uppercase tracking-widest text-gray-500">
              Partnerschaft · Werbung
            </span>
            <h2 className="text-2xl sm:text-3xl font-800 text-navy-900">
              Üben zwischen den Lektionen,{" "}
              <span style={{ color: FLOWKEY.orange }}>{FLOWKEY.rabattProzent} % günstiger</span>
            </h2>
            <p className="text-gray-600 leading-relaxed max-w-xl">
              Ich bin Partner von flowkey, einer App zum Klavierlernen. Mit meinem Code bekommst du{" "}
              {FLOWKEY.rabattProzent} % auf jedes Abo. Ich erhalte dafür eine Provision, für dich wird es günstiger.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-3">
            <FlowkeyCode klein />
            <Link
              href="/flowkey"
              className="press inline-flex items-center gap-2 text-sm font-600 text-navy-900 hover:underline underline-offset-4"
            >
              Mehr erfahren <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
