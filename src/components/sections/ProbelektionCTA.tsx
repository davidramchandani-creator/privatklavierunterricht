import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarCheck, ArrowRight } from "lucide-react";

export default function ProbelektionCTA() {
  return (
    <section
      id="probelektion"
      className="py-20 md:py-28 relative overflow-hidden"
    >
      {/* Ankerpunkt für die mitlaufende Leiste: sobald dieser Block im Bild
          ist, zieht sie sich zurück. Sonst stünden zwei
          Probelektions-Knöpfe übereinander. */}
      <div id="probelektion-cta" className="absolute inset-0 pointer-events-none" aria-hidden />
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-navy-900 to-navy-700" />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-white/50 font-600 text-xs uppercase tracking-widest mb-3">
          Jetzt starten
        </p>
        <h2 className="text-3xl sm:text-4xl font-800 text-white mb-6 tracking-tight">
          Bereit für deine erste Lektion?
        </h2>
        <p className="text-white/70 mb-10 max-w-xl mx-auto leading-relaxed">
          Schreib mir eine kurze Nachricht und wir finden gemeinsam einen
          passenden Termin. Keine Verpflichtung, kein Abonnement. Einfach
          loslegen.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/probelektion">
            <Button size="lg" className="gap-2 bg-white text-navy-900 hover:bg-gray-100 shadow-lg shadow-black/20 w-full sm:w-auto font-700">
              <CalendarCheck className="w-5 h-5" />
              Probelektion anfragen
            </Button>
          </Link>
          <Link href="/#angebote">
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white hover:text-navy-900 gap-2 w-full sm:w-auto"
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
