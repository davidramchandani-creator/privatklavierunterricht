import Link from "next/link";

/**
 * Kopf einer Unterseite: dunkler Grund wie bei „Über mich", Kicker,
 * Überschrift, ein Satz und Sprungmarken zu den Abschnitten der Seite.
 *
 * Die Sprungmarken sind der Grund für diese Komponente: Wer über das
 * Klappmenü kommt, will oft nur zu einem Teil. Sie stehen gleich oben,
 * damit man nicht durch die ganze Seite scrollt, um ihn zu finden.
 */
export default function SeitenKopf({
  kicker,
  titel,
  text,
  sprungmarken = [],
}: {
  kicker: string;
  titel: React.ReactNode;
  text: React.ReactNode;
  sprungmarken?: { href: string; label: string }[];
}) {
  return (
    <section className="bg-navy-900 pt-32 pb-16 px-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="max-w-7xl mx-auto sm:px-2 lg:px-4 relative">
        <div className="max-w-2xl space-y-5 opacity-0 animate-fade-in">
          <p className="text-white/50 font-600 text-xs uppercase tracking-widest">{kicker}</p>
          <h1 className="text-4xl sm:text-5xl font-800 text-white leading-[1.1] tracking-tight">{titel}</h1>
          <p className="text-white/70 text-lg leading-relaxed">{text}</p>
          {sprungmarken.length > 0 && (
            <nav aria-label="Auf dieser Seite" className="flex flex-wrap gap-2 pt-2">
              {sprungmarken.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-500 text-white/80 hover:bg-white/[0.12] hover:text-white hover:-translate-y-px transition"
                >
                  {m.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}
