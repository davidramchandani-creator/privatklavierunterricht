import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowDown, CalendarCheck } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#1C244B]">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Gold accent glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#C9A84C]/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8 opacity-0 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse" />
          <span className="text-white/80 text-sm font-500">
            Klavierunterricht in Neftenbach & Umgebung
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-800 text-white leading-[1.1] tracking-tight mb-6 opacity-0 animate-fade-in delay-100">
          Spiel, was du fühlst –{" "}
          <span className="text-[#C9A84C]">ich zeig dir wie.</span>
        </h1>

        {/* Subtext */}
        <p className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed opacity-0 animate-fade-in delay-200">
          Individueller Klavierunterricht mit David, ganz ohne Schema F,
          dafür mit Gefühl und Verstand.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center opacity-0 animate-fade-in delay-300">
          <Link href="/#probelektion">
            <Button
              size="lg"
              variant="gold"
              className="gap-2 shadow-xl shadow-[#C9A84C]/20"
            >
              <CalendarCheck className="w-5 h-5" />
              Jetzt Probelektion buchen
            </Button>
          </Link>
          <Link href="/#angebote">
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white hover:text-[#1C244B]"
            >
              Zu den Angeboten
            </Button>
          </Link>
        </div>

        {/* Scroll indicator */}
        <div className="mt-16 opacity-0 animate-fade-in delay-500">
          <Link href="/#angebote" className="inline-flex flex-col items-center gap-2 text-white/40 hover:text-white/60 transition-colors">
            <span className="text-xs font-500 uppercase tracking-widest">
              Entdecken
            </span>
            <ArrowDown className="w-4 h-4 animate-bounce" />
          </Link>
        </div>
      </div>
    </section>
  );
}
