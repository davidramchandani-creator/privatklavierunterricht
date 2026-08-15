"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Plus, ExternalLink } from "lucide-react";
import { bewertungVonHand } from "@/app/admin/actions";
import { GOOGLE_PROFIL_URL } from "@/lib/google-bewertung";

/**
 * Bewertungen abtippen, die anderswo stehen.
 *
 * Google zeigt Bewertungen nur bei Google. Wer direkt auf der Startseite
 * landet, sieht sie nie, es sei denn, sie stehen auch hier. Deshalb dieser
 * Weg: kopieren, einfügen, fertig.
 */
export default function BewertungEintragen() {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [sterne, setSterne] = useState(5);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starteUebergang] = useTransition();

  function absenden(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFehler(null);
    const daten = new FormData(e.currentTarget);
    daten.set("sterne", String(sterne));
    const formular = e.currentTarget;
    starteUebergang(async () => {
      const r = await bewertungVonHand(daten);
      if (r && "error" in r && r.error) {
        setFehler(r.error);
        return;
      }
      formular.reset();
      setSterne(5);
      setOffen(false);
      router.refresh();
    });
  }

  if (!offen) {
    return (
      <div className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-[#EAECEF] p-4">
        <p className="text-sm text-gray-500">
          Eine Bewertung von Google oder anderswo auf die Seite holen.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={GOOGLE_PROFIL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-600 text-gray-500 hover:text-gray-800 inline-flex items-center gap-1"
          >
            Google öffnen
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={() => setOffen(true)}
            className="press inline-flex items-center gap-1.5 text-xs font-600 px-3 py-2 rounded-lg bg-[#1C244B] text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            Eintragen
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={absenden}
      className="bg-white rounded-2xl border border-[#EAECEF] p-5 space-y-4"
    >
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i} von 5 Sternen`}
            onClick={() => setSterne(i)}
            className="press p-0.5"
          >
            <Star
              className={`w-7 h-7 ${
                i <= sterne
                  ? "fill-amber-400 text-amber-400"
                  : "fill-gray-200 text-gray-200"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-600 text-gray-600">Vorname</label>
          <input
            name="name"
            maxLength={60}
            className="w-full rounded-xl border border-gray-200 p-2.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-600 text-gray-600">Woher</label>
          <select
            name="quelle"
            defaultValue="google"
            className="w-full rounded-xl border border-gray-200 p-2.5 text-sm bg-white"
          >
            <option value="google">Google</option>
            <option value="matchspace">Matchspace</option>
            <option value="admin">Direkt bei mir</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-600 text-gray-600">
          Text, genau wie geschrieben
        </label>
        <textarea
          name="text"
          rows={4}
          className="w-full rounded-xl border border-gray-200 p-2.5 text-sm"
        />
        <p className="text-xs text-gray-400">
          Nichts glätten. Kürzen kannst du danach an der Karte, das lässt nur
          weg statt umzuschreiben.
        </p>
      </div>

      {fehler && <p className="text-xs text-red-600">{fehler}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={laeuft}
          className="press text-xs font-600 px-3 py-2 rounded-lg bg-[#1C244B] text-white disabled:opacity-40"
        >
          Speichern
        </button>
        <button
          type="button"
          onClick={() => setOffen(false)}
          className="press text-xs font-600 px-3 py-2 rounded-lg border border-gray-200 text-gray-600"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
