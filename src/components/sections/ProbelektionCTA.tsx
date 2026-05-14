import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarCheck, ArrowRight } from "lucide-react";

export default function ProbelektionCTA() {
  return (
    <section id="probelektion" className="py-24 bg-[#1C244B]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-[#C9A84C] font-600 text-sm uppercase tracking-widest mb-3">
          Jetzt starten
        </p>
        <h2 className="text-3xl sm:text-4xl font-800 text-white mb-6">
          Bereit für deine erste Lektion?
        </h2>
        <p className="text-white/60 mb-10 max-w-xl mx-auto leading-relaxed">
          Schreib mir eine kurze Nachricht und wir finden gemeinsam einen
          passenden Termin. Keine Verpflichtung, kein Abonnement – einfach
          loslegen.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="mailto:david@privatklavierunterricht.ch?subject=Probelektion anfragen"
          >
            <Button size="lg" variant="gold" className="gap-2 shadow-lg shadow-[#C9A84C]/20">
              <CalendarCheck className="w-5 h-5" />
              Probelektion anfragen
            </Button>
          </a>
          <Link href="/#angebote">
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white hover:text-[#1C244B] gap-2"
            >
              Alle Angebote
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
