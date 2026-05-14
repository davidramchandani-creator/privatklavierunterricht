"use client";

import { useState, useTransition } from "react";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitBewertung } from "../actions";

type Bewertung = {
  id: string;
  sterne: number;
  text: string | null;
  anzeigen: boolean;
};

export default function BewertungSection({
  schueler_id,
  vorhandene,
  vorname,
}: {
  schueler_id: string;
  vorhandene: Bewertung | null;
  vorname: string;
}) {
  const [sterne, setSterne] = useState(vorhandene?.sterne ?? 0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState(vorhandene?.text ?? "");
  const [submitted, setSubmitted] = useState(!!vorhandene);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="font-600 text-gray-900">Bewertung abgegeben – danke, {vorname}!</p>
            <div className="flex gap-0.5 mt-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${i <= (vorhandene?.sterne ?? sterne) ? "text-amber-400 fill-amber-400" : "text-gray-200"}`}
                />
              ))}
            </div>
            {(vorhandene?.text || text) && (
              <p className="text-sm text-gray-500 mt-2 italic">"{vorhandene?.text ?? text}"</p>
            )}
            {!vorhandene?.anzeigen && (
              <p className="text-xs text-gray-400 mt-2">Wird nach Freigabe öffentlich angezeigt.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  function handleSubmit() {
    if (sterne === 0) {
      setError("Bitte wähle eine Sternebewertung.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitBewertung(schueler_id, sterne, text.trim() || null);
      if (result?.error) setError(result.error);
      else setSubmitted(true);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      <p className="text-sm text-gray-600">
        Wie gefällt dir der Unterricht? Deine Bewertung hilft anderen Schülerinnen und Schülern.
      </p>

      {/* Stars */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setSterne(i)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`w-8 h-8 transition-colors ${
                i <= (hovered || sterne) ? "text-amber-400 fill-amber-400" : "text-gray-200"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Text */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Möchtest du noch etwas schreiben? (optional)"
        rows={3}
        maxLength={500}
        className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#3730A3]/20 focus:border-[#3730A3] transition-colors placeholder:text-gray-400"
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <Button onClick={handleSubmit} disabled={isPending} className="w-full sm:w-auto">
        {isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Senden…</>
        ) : (
          "Bewertung abschicken"
        )}
      </Button>
    </div>
  );
}
