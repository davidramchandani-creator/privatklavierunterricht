import { Star, Quote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

interface Bewertung {
  id: string;
  sterne: number;
  text: string | null;
  abgegeben_am: string | null;
  anonym: boolean;
  schueler: { name: string } | null;
}

async function getBewertungen(): Promise<Bewertung[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("bewertungen")
      .select("id, sterne, text, abgegeben_am, anonym, schueler:schueler_id(name)")
      .eq("anzeigen", true)
      .eq("status", "abgegeben")
      .order("abgegeben_am", { ascending: false })
      .limit(6);
    return (data as unknown as Bewertung[]) ?? [];
  } catch {
    return [];
  }
}

function Sterne({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i <= count
              ? "fill-[#C9A84C] text-[#C9A84C]"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

// Platzhalter-Bewertungen, bis echte vorhanden sind
const PLACEHOLDER: Omit<Bewertung, "schueler">[] = [
  {
    id: "p1",
    sterne: 5,
    text: "David ist ein unglaublicher Lehrer! Nach nur 3 Monaten kann ich bereits meine Lieblingslieder spielen. Sein Unterricht ist so motivierend.",
    abgegeben_am: null,
    anonym: false,
  },
  {
    id: "p2",
    sterne: 5,
    text: "Endlich Klavierunterricht ohne trockene Theorie. David passt sich genau meinem Tempo an und macht den Unterricht immer spannend.",
    abgegeben_am: null,
    anonym: false,
  },
  {
    id: "p3",
    sterne: 5,
    text: "Als kompletter Anfänger hatte ich Bedenken, aber David hat mich sofort abgeholt. Sehr empfehlenswert!",
    abgegeben_am: null,
    anonym: true,
  },
];

export default async function Bewertungen() {
  const bewertungen = await getBewertungen();
  const anzeigen =
    bewertungen.length > 0
      ? bewertungen
      : PLACEHOLDER.map((p) => ({ ...p, schueler: null }));

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-[#C9A84C] font-600 text-sm uppercase tracking-widest mb-3">
            Stimmen
          </p>
          <h2 className="text-3xl sm:text-4xl font-800 text-[#1C244B] mb-4">
            Was Schüler sagen
          </h2>
          <div className="flex items-center justify-center gap-2">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className="w-5 h-5 fill-[#C9A84C] text-[#C9A84C]"
                />
              ))}
            </div>
            <span className="font-700 text-[#1C244B]">5.0</span>
            <span className="text-gray-500 text-sm">
              · {anzeigen.length} Bewertungen
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {anzeigen.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <Quote className="w-8 h-8 text-[#C9A84C]/30 mb-3" />
              <Sterne count={b.sterne} />
              {b.text && (
                <p className="text-gray-600 mt-3 mb-4 text-sm leading-relaxed">
                  &ldquo;{b.text}&rdquo;
                </p>
              )}
              <p className="text-xs font-600 text-gray-400">
                {b.anonym
                  ? "Anonymer Schüler"
                  : (b.schueler as { name: string } | null)?.name ??
                    "Schüler/in"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
