import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Star, Users, Clock, ArrowRight } from "lucide-react";
import { getNextPublicSlot } from "@/app/probelektion/actions";

function formatSlot(iso: string): string {
  const d = new Date(iso);
  const tag = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    weekday: "long",
  }).format(d);
  const datum = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    day: "numeric",
    month: "long",
  }).format(d);
  const zeit = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${tag}, ${datum} · ${zeit} Uhr`;
}

export default async function Hero() {
  let nextSlotLabel = "Auf Anfrage";
  try {
    const slot = await getNextPublicSlot();
    if (slot) nextSlotLabel = formatSlot(slot.beginn);
  } catch {
    // Falls Verfügbarkeit nicht geladen werden kann, bleibt der Fallback stehen.
  }

  return (
    <section className="relative min-h-screen bg-white flex items-center overflow-hidden">
      {/* Soft ambient light */}
      <div className="absolute -top-40 -right-40 w-[680px] h-[680px] rounded-full bg-gradient-to-br from-navy-100/70 via-navy-50/40 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -bottom-48 -left-40 w-[560px] h-[560px] rounded-full bg-gradient-to-tr from-surface to-transparent blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-0">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center min-h-screen md:min-h-[auto] md:py-32">

          {/* Left: Text content */}
          <div className="space-y-8 opacity-0 animate-fade-in">
            {/* Overline badge */}
            <div className="inline-flex items-center gap-2 bg-navy-50 border border-navy-100 rounded-full px-4 py-1.5">
              <span className="w-2 h-2 rounded-full bg-navy-400 animate-pulse" />
              <span className="text-navy-900 text-sm font-600">
                Klavierunterricht in Neftenbach & Umgebung
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-800 text-navy-900 leading-[1.1] tracking-tight">
              Spiel, was du fühlst –{" "}
              <span className="italic font-700 text-navy-600">ich zeig dir wie.</span>
            </h1>

            {/* Subtext */}
            <p className="text-lg text-gray-500 leading-relaxed max-w-lg font-400">
              Individueller Klavierunterricht mit David, ganz ohne Schema F,
              dafür mit Gefühl und Verstand.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 opacity-0 animate-fade-in delay-200">
              <Link href="/probelektion">
                <Button size="lg" className="gap-2 shadow-lg shadow-navy-900/20 w-full sm:w-auto">
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
              <Pill icon={<Users className="w-3.5 h-3.5 text-navy-900" />} text="200+ Schülerinnen & Schüler" />
              <Pill icon={<Clock className="w-3.5 h-3.5 text-navy-900" />} text="16+ Jahre Erfahrung" />
            </div>
          </div>

          {/* Right: Visual panel */}
          <div className="relative opacity-0 animate-fade-in delay-100 flex justify-center md:justify-end">
            <div className="relative w-full max-w-sm">
              {/* Main card */}
              <div className="rounded-3xl bg-navy-900 p-8 shadow-2xl shadow-navy-900/20 overflow-hidden">
                {/* Keyboard accent — clean SVG, top of card */}
                <Keyboard className="mb-8 opacity-90" />

                <div className="text-white space-y-2">
                  <p className="text-white/50 text-xs font-600 uppercase tracking-widest">Nächster freier Termin</p>
                  <p className="text-2xl font-800 leading-tight">{nextSlotLabel}</p>
                  <p className="text-white/60 text-sm">Bei dir zu Hause · 45 Min.</p>
                </div>

                <Link
                  href="/probelektion"
                  className="group mt-6 bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 rounded-2xl px-4 py-3.5 flex items-center justify-between transition-colors"
                >
                  <div>
                    <p className="text-white/55 text-xs">Im 20er-Paket ab</p>
                    <p className="text-white font-800 text-xl">CHF 65 <span className="text-sm font-500 text-white/55">/ Lektion</span></p>
                  </div>
                  <span className="w-9 h-9 rounded-full bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                    <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              </div>

              {/* Floating badge: Erfahrung */}
              <div className="absolute -top-5 -left-5 bg-white rounded-2xl shadow-lg px-4 py-3 border border-gray-100">
                <p className="text-2xl font-800 text-navy-900">16+</p>
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
    <div className="inline-flex items-center gap-1.5 bg-surface border border-gray-100 rounded-full px-3 py-1.5 text-xs font-500 text-gray-600">
      {icon}
      {text}
    </div>
  );
}

// Saubere, dezente Klaviatur als SVG (eine Oktave + Anschnitt)
function Keyboard({ className = "" }: { className?: string }) {
  const whiteCount = 8;
  const whiteW = 100 / whiteCount;
  // Schwarze Tasten sitzen rechts von den weissen Tasten 0,1,3,4,5
  const blackAfter = [0, 1, 3, 4, 5];
  const blackW = whiteW * 0.58;
  return (
    <svg
      viewBox="0 0 100 46"
      className={`w-full h-16 ${className}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Weisse Tasten */}
      {Array.from({ length: whiteCount }).map((_, i) => (
        <rect
          key={`w${i}`}
          x={i * whiteW + 0.4}
          y={0}
          width={whiteW - 0.8}
          height={46}
          rx={1.5}
          className="fill-white"
        />
      ))}
      {/* Schwarze Tasten */}
      {blackAfter.map((i) => (
        <rect
          key={`b${i}`}
          x={(i + 1) * whiteW - blackW / 2}
          y={0}
          width={blackW}
          height={28}
          rx={1.2}
          className="fill-navy-900"
        />
      ))}
    </svg>
  );
}
