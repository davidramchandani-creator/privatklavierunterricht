import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Music } from "lucide-react";

export default function UeberMichTeaser() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Bild */}
          <div className="relative order-2 lg:order-1">
            <div className="relative aspect-[4/5] max-w-md mx-auto lg:mx-0 rounded-2xl overflow-hidden bg-gray-100">
              {/* Placeholder bis Foto kommt */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#1C244B] to-[#2a3469] flex items-center justify-center">
                <div className="text-center text-white/40">
                  <Music className="w-16 h-16 mx-auto mb-3" />
                  <p className="text-sm">Foto folgt</p>
                </div>
              </div>
              {/* Sobald Foto bereit: */}
              {/* <Image src="/david.jpg" alt="David – Klavierlehrer" fill className="object-cover" /> */}
            </div>

            {/* Floating stat */}
            <div className="absolute -bottom-4 -right-4 lg:right-0 bg-[#C9A84C] text-[#1C244B] rounded-2xl px-5 py-4 shadow-lg shadow-[#C9A84C]/30">
              <p className="text-3xl font-800 leading-none">16</p>
              <p className="text-xs font-600 mt-0.5">Jahre Erfahrung</p>
            </div>
          </div>

          {/* Text */}
          <div className="order-1 lg:order-2">
            <p className="text-[#C9A84C] font-600 text-sm uppercase tracking-widest mb-3">
              Über mich
            </p>
            <h2 className="text-3xl sm:text-4xl font-800 text-[#1C244B] mb-6 leading-tight">
              Hallo, ich bin David –<br />
              <span className="text-gray-400 font-500 text-2xl">
                dein Klavierlehrer.
              </span>
            </h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              Ich bin 21 Jahre alt und habe 16 Jahre Klaviererfahrung. Ich teile
              gern mein Wissen und meine Techniken, um anderen das
              Klavierspielen beizubringen.
            </p>
            <p className="text-gray-600 leading-relaxed mb-4">
              Mir geht es um Technik, Begeisterung und Freude am Klavierspiel.
              Jeder Schüler ist einzigartig, deshalb erkenne ich ihre Talente
              und Bedürfnisse individuell.
            </p>
            <p className="text-gray-600 leading-relaxed mb-8">
              Ich schaffe eine positive Lernatmosphäre, die das Selbstvertrauen
              stärkt. Spass am Lernen ist mir wichtig, während ich eine solide
              Grundlage für musikalisches Wachstum lege.
            </p>

            <Link href="/ueber-mich">
              <Button size="lg" className="gap-2">
                Mehr über mich erfahren
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
