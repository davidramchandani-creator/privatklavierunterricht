"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Check, X, Loader2, Scissors } from "lucide-react";
import { bewertungEntscheiden, bewertungKuerzen } from "@/app/admin/actions";

export type AdminBewertung = {
  id: string;
  name: string | null;
  sterne: number;
  text: string | null;
  textKurz: string | null;
  status: "offen" | "freigegeben" | "abgelehnt";
  quelle: string;
  datum: string;
};

const QUELLEN: Record<string, string> = {
  formular: "über das Formular",
  website_alt: "von der alten Website",
  matchspace: "von Matchspace",
  admin: "von Hand eingetragen",
};

function Sterne({ anzahl }: { anzahl: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${anzahl} von 5 Sternen`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i <= anzahl
              ? "fill-amber-400 text-amber-400"
              : "fill-gray-200 text-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

function Karte({
  b,
  laeuft,
  fuehreAus,
}: {
  b: AdminBewertung;
  laeuft: string | null;
  fuehreAus: (id: string, fn: () => Promise<unknown>) => void;
}) {
  const [kuerzen, setKuerzen] = useState(false);
  const [entwurf, setEntwurf] = useState(b.textKurz ?? b.text ?? "");
  const [hinweis, setHinweis] = useState<string | null>(null);

  const zuLang = b.text !== null && entwurf.trim().length > b.text.length;

  return (
    <div className="bg-white rounded-2xl border border-[#EAECEF] p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Sterne anzahl={b.sterne} />
          <p className="text-sm font-700 text-[#1C244B] mt-1.5">
            {b.name ?? <span className="text-gray-400 font-500">ohne Namen</span>}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {b.datum}
            <span className="mx-1.5 text-gray-300">·</span>
            {QUELLEN[b.quelle] ?? b.quelle}
          </p>
        </div>
        {b.status !== "offen" && (
          <span
            className={`shrink-0 text-xs font-600 px-2.5 py-1 rounded-lg ${
              b.status === "freigegeben"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {b.status === "freigegeben" ? "Auf der Website" : "Abgelehnt"}
          </span>
        )}
      </div>

      {b.text ? (
        <p className="text-sm text-gray-600 leading-relaxed">{b.text}</p>
      ) : (
        <p className="text-sm text-gray-400 italic">
          Nur Sterne, kein Text. Zählt in Schnitt und Anzahl mit, bekommt auf der
          Website aber keine Karte.
        </p>
      )}

      {b.textKurz && !kuerzen && (
        <div className="bg-[#F3F5F8] rounded-xl p-3">
          <p className="text-xs font-600 text-gray-400 uppercase tracking-wide mb-1">
            Kurzfassung für die Startseite
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">{b.textKurz}</p>
        </div>
      )}

      {kuerzen && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Nur weglassen, nichts umformulieren. Leer lassen heisst: überall der
            volle Text.
          </p>
          <textarea
            value={entwurf}
            onChange={(e) => setEntwurf(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1C244B]/20"
          />
          {zuLang && (
            <p className="text-xs text-red-600">
              Die Kurzfassung ist länger als das Original. Dann wurde etwas
              hinzugefügt statt weggelassen.
            </p>
          )}
          {hinweis && <p className="text-xs text-red-600">{hinweis}</p>}
          <div className="flex gap-2">
            <button
              onClick={() =>
                fuehreAus(b.id, async () => {
                  const r = await bewertungKuerzen(b.id, entwurf);
                  if (r && "error" in r && r.error) setHinweis(r.error);
                  else setKuerzen(false);
                })
              }
              disabled={laeuft !== null || zuLang}
              className="press text-xs font-600 px-3 py-2 rounded-lg bg-[#1C244B] text-white disabled:opacity-40"
            >
              Speichern
            </button>
            <button
              onClick={() => setKuerzen(false)}
              className="press text-xs font-600 px-3 py-2 rounded-lg border border-gray-200 text-gray-600"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {b.status !== "freigegeben" && (
          <button
            onClick={() =>
              fuehreAus(b.id, () => bewertungEntscheiden(b.id, "freigegeben"))
            }
            disabled={laeuft !== null}
            className="press inline-flex items-center gap-1.5 text-xs font-600 px-3 py-2 rounded-lg bg-[#1C244B] text-white disabled:opacity-40"
          >
            {laeuft === b.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Freigeben
          </button>
        )}
        {b.status !== "abgelehnt" && (
          <button
            onClick={() =>
              fuehreAus(b.id, () => bewertungEntscheiden(b.id, "abgelehnt"))
            }
            disabled={laeuft !== null}
            className="press inline-flex items-center gap-1.5 text-xs font-600 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40"
          >
            <X className="w-3.5 h-3.5" />
            {b.status === "freigegeben" ? "Von der Website nehmen" : "Ablehnen"}
          </button>
        )}
        {b.text && !kuerzen && (
          <button
            onClick={() => setKuerzen(true)}
            className="press inline-flex items-center gap-1.5 text-xs font-600 px-3 py-2 rounded-lg border border-gray-200 text-gray-600"
          >
            <Scissors className="w-3.5 h-3.5" />
            Kürzen
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Die Liste im Admin.
 *
 * Offene zuerst, weil sie das Einzige sind, was eine Handlung verlangt. Der
 * Rest ist Archiv und darf weiter unten stehen.
 */
export default function BewertungsListe({
  bewertungen,
}: {
  bewertungen: AdminBewertung[];
}) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function fuehreAus(id: string, fn: () => Promise<unknown>) {
    setLaeuft(id);
    startTransition(async () => {
      await fn();
      setLaeuft(null);
      router.refresh();
    });
  }

  const offen = bewertungen.filter((b) => b.status === "offen");
  const rest = bewertungen.filter((b) => b.status !== "offen");

  if (bewertungen.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#EAECEF] p-6 text-center">
        <p className="text-sm text-gray-500">
          Noch keine Bewertungen. Du kannst Schüler beim jeweiligen Profil um
          eine bitten.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {offen.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-700 text-[#1C244B]">
            Wartet auf dich ({offen.length})
          </h2>
          {offen.map((b) => (
            <Karte key={b.id} b={b} laeuft={laeuft} fuehreAus={fuehreAus} />
          ))}
        </section>
      )}

      {rest.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-700 text-[#1C244B]">Bereits entschieden</h2>
          {rest.map((b) => (
            <Karte key={b.id} b={b} laeuft={laeuft} fuehreAus={fuehreAus} />
          ))}
        </section>
      )}
    </div>
  );
}
