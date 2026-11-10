import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  Handshake,
  Headphones,
  Layers,
  Library,
  Music,
  Repeat,
  ShieldCheck,
} from "lucide-react";
import FlowkeyLogo from "@/components/FlowkeyLogo";
import FlowkeyCode from "@/components/FlowkeyCode";
import { FLOWKEY, FLOWKEY_FUNKTIONEN } from "@/lib/flowkey";

export const metadata: Metadata = {
  alternates: { canonical: "/flowkey" },
  title: "flowkey mit 25 % Rabatt: Partnerschaft | Privatklavierunterricht David Ramchandani",
  description: `Ich bin Partner von flowkey. Mit dem Code ${FLOWKEY.code} bekommst du ${FLOWKEY.rabattProzent} % Rabatt auf jedes flowkey-Abo. Hier steht offen, was ich davon habe.`,
  robots: FLOWKEY.aktiv ? undefined : { index: false, follow: false },
};

const ICONS = [Library, Headphones, Repeat, Music, Layers];
const ORANGE_HELL = "#FFF3E6";

/**
 * Die Partnerseite für flowkey (von flowkey freigegeben, 10.11.2026).
 *
 * Gestaltung: hell und warm, damit das orange Logo auf hellem Grund steht
 * (Brand Guidelines: orange auf hell). Der Funktionsteil auf Navy setzt
 * einen Kontrast, ohne Logo. Der wichtigste Teil bleibt „Transparenz“:
 * Provision und Gratiszugang stehen ausdrücklich da.
 */
export default function FlowkeyPage() {
  return (
    <main>
      {/* ── Kopf ─────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden pt-28 pb-20 px-4"
        style={{ background: `linear-gradient(180deg, #FFFFFF 0%, ${ORANGE_HELL} 100%)` }}
      >
        <div
          className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full blur-3xl pointer-events-none opacity-60"
          style={{ background: "radial-gradient(circle, #FFD9AD 0%, transparent 70%)" }}
        />
        <div className="relative max-w-5xl mx-auto grid md:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 text-xs font-600 uppercase tracking-widest text-gray-500 bg-white/80 border border-[#EAECEF] rounded-full px-3 py-1">
              Partnerschaft · Werbung
            </span>
            <h1 className="text-4xl sm:text-5xl font-800 text-navy-900 leading-[1.1] tracking-tight">
              Üben zwischen den Lektionen,{" "}
              <span style={{ color: FLOWKEY.orange }}>{FLOWKEY.rabattProzent} % günstiger.</span>
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed max-w-xl">
              Ich bin Partner von flowkey, einer App zum Klavierlernen. Mit meinem Code bekommst du{" "}
              {FLOWKEY.rabattProzent} % Rabatt auf jedes flowkey-Abo.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <FlowkeyCode />
              <a
                href={FLOWKEY.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="press inline-flex items-center gap-2 rounded-xl px-6 py-4 font-700 text-white shadow-lg transition-transform hover:-translate-y-0.5"
                style={{ background: FLOWKEY.orange, boxShadow: "0 10px 30px -10px rgba(239,125,0,.6)" }}
              >
                Zu flowkey <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-xs text-gray-400">Code antippen zum Kopieren, dann beim Kauf bei flowkey einfügen.</p>
          </div>

          <div className="flex justify-center md:justify-end">
            <div className="relative bg-white rounded-3xl border border-[#EAECEF] shadow-xl px-8 py-10 text-center transition-transform hover:-translate-y-1">
              <FlowkeyLogo hoehe={64} />
              <div className="mt-2 flex items-center justify-center gap-3 text-sm text-gray-500">
                <span className="font-700 text-navy-900">David</span>
                <span className="w-6 h-px bg-gray-300" />
                <span>Teacher Partner</span>
              </div>
              <div
                className="absolute -top-4 -left-4 w-16 h-16 rounded-2xl flex flex-col items-center justify-center text-white font-800 shadow-lg -rotate-6"
                style={{ background: FLOWKEY.orange }}
              >
                <span className="text-xl leading-none">−{FLOWKEY.rabattProzent}</span>
                <span className="text-[10px] font-600 tracking-wider">%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Was flowkey kann ─────────────────────────────── */}
      <section className="py-20 px-4 bg-navy-900">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="max-w-2xl">
            <p className="text-xs font-600 uppercase tracking-widest mb-2" style={{ color: FLOWKEY.orange }}>
              Die App
            </p>
            <h2 className="text-3xl font-800 text-white">Was flowkey kann</h2>
            <p className="text-white/60 mt-3 leading-relaxed">
              Selbständig Klavier üben, auf dem Handy, Tablet oder Computer, mit deinem Klavier oder E-Piano.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FLOWKEY_FUNKTIONEN.map((f, i) => {
              const Icon = ICONS[i] ?? Music;
              return (
                <div
                  key={f.titel}
                  className={`group rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.08] ${
                    i === 0 ? "lg:col-span-2" : ""
                  }`}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                    style={{ background: "rgba(239,125,0,.15)" }}
                  >
                    <Icon className="w-5 h-5" style={{ color: FLOWKEY.orange }} />
                  </div>
                  <h3 className="font-800 text-white mb-1.5">{f.titel}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{f.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Wie es zum Unterricht passt ─────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-start">
          <div className="space-y-4">
            <p className="text-xs font-600 uppercase tracking-widest text-navy-600">Im Unterricht</p>
            <h2 className="text-3xl font-800 text-navy-900">Wie flowkey zu meinem Unterricht passt</h2>
            <p className="text-gray-600 leading-relaxed">
              Im Unterricht arbeiten wir mit Abschnitten, Mustern und dem Gehör. Noten setze ich dort ein, wo sie
              dir helfen, mit guten Medien und Apps, und flowkey ist eine davon.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Für meinen Unterricht brauchst du flowkey nicht. Die App ersetzt keine Lektion, sie kann aber helfen,
              zwischen den Lektionen dranzubleiben. Ob sie zu dir passt, entscheidest du selbst.
            </p>
          </div>
          <ol className="space-y-3">
            {[
              ["In der Lektion", "Wir schauen uns ein Stück an: Abschnitte, Muster, wie es klingt."],
              ["Zu Hause mit flowkey", "Du übst einen Abschnitt langsam und in der Schlaufe, jede Hand einzeln."],
              ["In der nächsten Lektion", "Wir bauen darauf auf und gehen den nächsten Schritt."],
            ].map(([titel, text], i) => (
              <li key={titel} className="flex gap-4 bg-surface rounded-2xl p-5 transition-transform hover:-translate-y-0.5">
                <span
                  className="w-9 h-9 rounded-full text-white text-sm font-800 flex items-center justify-center shrink-0"
                  style={{ background: i === 1 ? FLOWKEY.orange : "#1C244B" }}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="font-700 text-navy-900">{titel}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Transparenz und Daten ────────────────────────── */}
      <section className="py-20 px-4 bg-surface">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-5">
          <Karte icon={<Handshake className="w-5 h-5" />} titel="Transparenz: Was ich davon habe">
            <p>
              Ich bin Teil des Partnerprogramms von flowkey. Wenn du ein Abo mit meinem Code{" "}
              <strong>{FLOWKEY.code}</strong> abschliesst, bekomme ich von flowkey eine Provision, auch bei
              Verlängerungen. Ausserdem stellt mir flowkey die App kostenlos zur Verfügung.
            </p>
            <p>
              Für dich wird es dadurch nicht teurer: Du zahlst mit dem Code {FLOWKEY.rabattProzent} % weniger als
              ohne. Am Preis meines Unterrichts ändert sich nichts, und niemand muss flowkey nutzen.
            </p>
          </Karte>
          <Karte icon={<ShieldCheck className="w-5 h-5" />} titel="Deine Daten">
            <p>
              Ich gebe keine Daten von dir an flowkey weiter. Den Code löst du selbst bei flowkey ein, und dein Abo
              läuft direkt über flowkey.
            </p>
            <p>Dafür gelten die Bedingungen und die Datenschutzerklärung von flowkey.</p>
          </Karte>
        </div>
      </section>

      {/* ── Schluss ──────────────────────────────────────── */}
      <section className="py-16 px-4" style={{ background: ORANGE_HELL }}>
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <FlowkeyLogo hoehe={40} />
          <h2 className="text-2xl sm:text-3xl font-800 text-navy-900">Bereit zum Üben?</h2>
          <div className="flex flex-wrap justify-center items-center gap-4">
            <FlowkeyCode klein />
            <a
              href={FLOWKEY.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="press inline-flex items-center gap-2 rounded-xl px-5 py-3 font-700 text-white transition-transform hover:-translate-y-0.5"
              style={{ background: FLOWKEY.orange }}
            >
              Zu flowkey <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <p className="text-sm text-gray-500">
            Fragen dazu?{" "}
            <Link href="/kontakt" className="inline-flex items-center gap-1 font-600 text-navy-900 underline underline-offset-4">
              Schreib mir <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Karte({ icon, titel, children }: { icon: React.ReactNode; titel: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#EAECEF] p-7 space-y-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-navy-50 text-navy-900 flex items-center justify-center">{icon}</span>
        <h2 className="text-lg font-800 text-navy-900">{titel}</h2>
      </div>
      <div className="text-gray-600 leading-relaxed space-y-3 text-[15px]">{children}</div>
    </div>
  );
}
