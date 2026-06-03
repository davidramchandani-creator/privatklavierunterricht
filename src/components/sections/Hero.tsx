import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Star, Users, Clock } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-screen bg-white flex items-center overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#1C244B 1px, transparent 1px), linear-gradient(90deg, #1C244B 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Indigo gradient blob top-right */}
      <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-navy-100 to-navy-50 blur-3xl opacity-60 pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-0">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center min-h-screen md:min-h-[auto] md:py-32">

          {/* Left: Text content */}
          <div className="space-y-8 opacity-0 animate-fade-in">
            {/* Overline badge */}
            <div className="inline-flex items-center gap-2 bg-navy-50 border border-navy-100 rounded-full px-4 py-1.5">
              <span className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse" />
              <span className="text-[#1C244B] text-sm font-600">
                Klavierunterricht in Neftenbach & Umgebung
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-800 text-gray-900 leading-[1.1] tracking-tight">
              Spiel, was du fühlst –{" "}
              <span className="text-[#1C244B]">ich zeig dir wie.</span>
            </h1>

            {/* Subtext */}
            <p className="text-lg text-gray-500 leading-relaxed max-w-lg">
              Individueller Klavierunterricht mit David, ganz ohne Schema F,
              dafür mit Gefühl und Verstand.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 opacity-0 animate-fade-in delay-200">
              <Link href="/probelektion">
                <Button size="lg" variant="gold" className="gap-2 shadow-lg shadow-[#C9A84C]/20 w-full sm:w-auto">
                  <CalendarCheck className="w-5 h-5" />
                  Jetzt Probelektion buchen
                </Button>
              </Link>
              <Link href="/#angebote">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Zu den Angeboten
                </Button>
              </Link>
            </div>

            {/* Social proof pills */}
            <div className="flex flex-wrap gap-3 pt-2 opacity-0 animate-fade-in delay-300">
              <Pill icon={<Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />} text="5.0 Sterne" />
              <Pill icon={<Users className="w-3.5 h-3.5 text-[#1C244B]" />} text="200+ Schülerinnen & Schüler" />
              <Pill icon={<Clock className="w-3.5 h-3.5 text-[#1C244B]" />} text="16+ Jahre Erfahrung" />
            </div>
          </div>

          {/* Right: Visual panel */}
          <div className="relative opacity-0 animate-fade-in delay-100 flex justify-center md:justify-end">
            <div className="relative w-full max-w-sm">
              {/* Main card */}
              <div className="rounded-3xl bg-gradient-to-br from-[#1C244B] to-[#3a4488] p-8 shadow-2xl shadow-navy-200">
                {/* Piano keys motif */}
                <div className="flex gap-1 mb-8 opacity-30">
                  {[1,2,3,4,5,6,7].map((i) => (
                    <div key={i} className="flex-1">
                      <div className="w-full h-20 bg-white rounded-b-lg" />
                    </div>
                  ))}
                </div>

                <div className="text-white space-y-2">
                  <p className="text-white/60 text-xs font-600 uppercase tracking-widest">Nächste freie Lektion</p>
                  <p className="text-2xl font-800">Montag, 14:00 Uhr</p>
                  <p className="text-white/70 text-sm">Bei dir zu Hause · 60 Min.</p>
                </div>

                <div className="mt-6 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-xs">Einzellektion ab</p>
                    <p className="text-white font-800 text-xl">CHF 105</p>
                  </div>
                  <div className="bg-[#C9A84C] text-white text-xs font-700 px-3 py-1.5 rounded-full">
                    Jetzt buchen
                  </div>
                </div>
              </div>

              {/* Floating badge: Erfahrung */}
              <div className="absolute -top-5 -left-5 bg-white rounded-2xl shadow-lg px-4 py-3 border border-gray-100">
                <p className="text-2xl font-800 text-[#1C244B]">16+</p>
                <p className="text-xs text-gray-400 font-500">Jahre Erfahrung</p>
              </div>

              {/* Floating badge: Reviews */}
              <div className="absolute -bottom-5 -right-5 bg-white rounded-2xl shadow-lg px-4 py-3 border border-gray-100 flex items-center gap-2">
                <div className="flex">
                  {[1,2,3,4,5].map((i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <div>
                  <p className="text-xs font-700 text-gray-900 leading-none">5.0</p>
                  <p className="text-[10px] text-gray-400 leading-none mt-0.5">Bewertungen</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 text-xs font-500 text-gray-600">
      {icon}
      {text}
    </div>
  );
}
