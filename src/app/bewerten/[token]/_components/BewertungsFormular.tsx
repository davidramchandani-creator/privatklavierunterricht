"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { bewertungAbgeben } from "@/app/bewerten/actions";

/**
 * Das Formular, das ein Schüler über den Link in der Mail sieht.
 *
 * Zwei Entscheidungen, die es kürzer machen, als es sein könnte:
 *
 *   **Der Text ist freiwillig.** Wer nur Sterne vergibt, hat trotzdem
 *   bewertet. Ein Pflichtfeld für die Begründung kostet mehr Antworten,
 *   als es gute Sätze bringt.
 *
 *   **Der Vorname ist vorausgefüllt**, aber änderbar. Manche schreiben als
 *   Eltern und wollen ihren eigenen Namen darunter, nicht den des Kindes.
 */
export default function BewertungsFormular({
  token,
  vorname,
}: {
  token: string;
  vorname: string;
}) {
  const [sterne, setSterne] = useState(0);
  const [schwebt, setSchwebt] = useState(0);
  const [text, setText] = useState("");
  const [name, setName] = useState(vorname);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);
  const [laeuft, starteUebergang] = useTransition();

  function senden() {
    setFehler(null);
    starteUebergang(async () => {
      const ergebnis = await bewertungAbgeben(token, sterne, text, name);
      if (ergebnis.ok) setFertig(true);
      else setFehler(ergebnis.fehler);
    });
  }

  if (fertig) {
    return (
      <div className="text-center space-y-3">
        <span className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </span>
        <h1 className="text-xl font-800 text-[#1C244B]">Danke dir</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Ich schaue sie mir an und stelle sie dann auf die Website. Das freut
          mich wirklich.
        </p>
        <Link
          href="/"
          className="inline-block text-sm font-600 text-[#1C244B] underline underline-offset-4"
        >
          Zur Website
        </Link>
      </div>
    );
  }

  const gezeigt = schwebt || sterne;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-800 text-[#1C244B]">
          Wie war der Unterricht?
        </h1>
        <p className="text-gray-500 text-sm mt-1 leading-relaxed">
          Ein paar Sterne genügen. Wenn du magst, schreib zwei Sätze dazu, die
          helfen anderen am meisten bei der Entscheidung.
        </p>
      </div>

      {/* Sterne */}
      <div
        className="flex gap-1"
        role="radiogroup"
        aria-label="Bewertung in Sternen"
        onMouseLeave={() => setSchwebt(0)}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={sterne === i}
            aria-label={`${i} von 5 Sternen`}
            onMouseEnter={() => setSchwebt(i)}
            onClick={() => setSterne(i)}
            className="press p-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1C244B]"
          >
            <Star
              className={`w-9 h-9 transition-colors ${
                i <= gezeigt
                  ? "fill-amber-400 text-amber-400"
                  : "fill-gray-200 text-gray-200"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label htmlFor="bewertung-text" className="block text-sm font-600 text-[#1C244B]">
          Dein Text <span className="font-400 text-gray-400">(freiwillig)</span>
        </label>
        <textarea
          id="bewertung-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Was hat dir gefallen?"
          className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1C244B]/20 focus:border-[#1C244B]"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="bewertung-name" className="block text-sm font-600 text-[#1C244B]">
          Vorname
        </label>
        <input
          id="bewertung-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1C244B]/20 focus:border-[#1C244B]"
        />
        <p className="text-xs text-gray-400">
          Auf der Website steht nur der Vorname, nie ein Nachname.
        </p>
      </div>

      {fehler && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
          {fehler}
        </p>
      )}

      <button
        onClick={senden}
        disabled={sterne === 0 || laeuft}
        className="press w-full h-12 rounded-xl bg-[#1C244B] text-white font-700 disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {laeuft ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {sterne === 0 ? "Bitte zuerst Sterne wählen" : "Bewertung abschicken"}
      </button>
    </div>
  );
}
