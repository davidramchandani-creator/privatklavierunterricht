"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { zeitenFuerSchuelerSetzen } from "@/app/admin/actions";
import {
  ZeitfensterListe,
  type AngegebenesFenster,
} from "@/components/ui/zeitfenster-liste";

/**
 * Zeiten für jemanden eintragen, der nicht geantwortet hat.
 *
 * Das Formular gab es bisher nur im Schülerportal. Wer auf die Umfrage
 * nicht reagierte — und das ist regelmässig ein Teil —, fiel damit still
 * aus jeder Zuteilung: keine Zeiten, kein Kandidat, kein Platz. David
 * kennt die Zeiten aber meist aus einem Telefonat.
 *
 * Was hier gespeichert wird, gilt als **Dauerangabe** und damit auch für
 * kommende Runden. Gibt der Schüler später selbst etwas an, sticht seine
 * Rundenangabe diese hier.
 */

const TAGE = [
  { nr: 1, lang: "Montag" },
  { nr: 2, lang: "Dienstag" },
  { nr: 3, lang: "Mittwoch" },
  { nr: 4, lang: "Donnerstag" },
  { nr: 5, lang: "Freitag" },
  { nr: 6, lang: "Samstag" },
  { nr: 0, lang: "Sonntag" },
];

const STUFEN = [
  { w: 1, t: "zur Not" },
  { w: 2, t: "gut" },
  { w: 3, t: "am besten" },
];

type Zeile = { aktiv: boolean; von: string; bis: string; praeferenz: number };

export default function ZeitenErfassen({
  studentId,
  vorhanden,
}: {
  studentId: string;
  /** Bereits gespeicherte Dauerangaben. */
  vorhanden: AngegebenesFenster[];
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  const [zeiten, setZeiten] = useState<Record<number, Zeile>>(() => {
    const start: Record<number, Zeile> = {};
    for (const t of TAGE) {
      const da = vorhanden.find((v) => v.wochentag === t.nr);
      start[t.nr] = da
        ? {
            aktiv: true,
            von: da.von.slice(0, 5),
            bis: da.bis.slice(0, 5),
            praeferenz: da.praeferenz ?? 2,
          }
        : { aktiv: false, von: "16:30", bis: "20:30", praeferenz: 2 };
    }
    return start;
  });

  function speichern() {
    setFehler(null);
    const fenster = Object.entries(zeiten)
      .filter(([, z]) => z.aktiv)
      .map(([nr, z]) => ({
        wochentag: Number(nr),
        fruehestens: z.von,
        spaetestens: z.bis,
        praeferenz: z.praeferenz,
      }));

    starte(async () => {
      const res = await zeitenFuerSchuelerSetzen(studentId, fenster);
      if ("error" in res && res.error) {
        setFehler(res.error);
        return;
      }
      setOffen(false);
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-700 text-[#1C244B]">Zeiten eintragen</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Für alle, die nicht selbst geantwortet haben. Gilt dauerhaft, bis
            der Schüler im Portal etwas anderes angibt.
          </p>
        </div>
        <button
          onClick={() => setOffen((o) => !o)}
          className="inline-flex items-center gap-1.5 text-xs font-600 text-[#1C244B] px-3 py-1.5 rounded-lg border border-[#1C244B]/20 hover:bg-[#1C244B]/5 transition-colors flex-shrink-0"
        >
          <Pencil className="w-3 h-3" />
          {offen ? "Abbrechen" : vorhanden.length > 0 ? "Ändern" : "Eintragen"}
        </button>
      </div>

      {fehler && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2.5 mb-3">
          {fehler}
        </p>
      )}

      {!offen ? (
        vorhanden.length > 0 ? (
          <ZeitfensterListe fenster={vorhanden} />
        ) : (
          <p className="text-sm text-gray-400">
            Keine dauerhaften Zeiten hinterlegt.
          </p>
        )
      ) : (
        <div className="space-y-2">
          {TAGE.map((t) => {
            const z = zeiten[t.nr];
            return (
              <div
                key={t.nr}
                className={`rounded-xl border transition-colors ${
                  z.aktiv
                    ? "border-[#1C244B]/30 bg-[#1C244B]/[0.03]"
                    : "border-gray-200"
                }`}
              >
                <label className="flex items-center gap-3 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={z.aktiv}
                    onChange={(e) =>
                      setZeiten((v) => ({
                        ...v,
                        [t.nr]: { ...v[t.nr], aktiv: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 rounded border-gray-300 text-[#1C244B]"
                  />
                  <span className="text-sm font-600 text-gray-900 flex-1">
                    {t.lang}
                  </span>
                </label>

                {z.aktiv && (
                  <div className="px-3 pb-3 flex items-center gap-2 flex-wrap">
                    <input
                      type="time"
                      step={900}
                      value={z.von}
                      onChange={(e) =>
                        setZeiten((v) => ({
                          ...v,
                          [t.nr]: { ...v[t.nr], von: e.target.value },
                        }))
                      }
                      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm"
                    />
                    <span className="text-xs text-gray-400">bis</span>
                    <input
                      type="time"
                      step={900}
                      value={z.bis}
                      onChange={(e) =>
                        setZeiten((v) => ({
                          ...v,
                          [t.nr]: { ...v[t.nr], bis: e.target.value },
                        }))
                      }
                      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm"
                    />
                    <div className="flex gap-1 ml-auto">
                      {STUFEN.map((p) => (
                        <button
                          key={p.w}
                          type="button"
                          onClick={() =>
                            setZeiten((v) => ({
                              ...v,
                              [t.nr]: { ...v[t.nr], praeferenz: p.w },
                            }))
                          }
                          className={`text-xs font-600 px-2 py-1.5 rounded-lg border transition-colors ${
                            z.praeferenz === p.w
                              ? "border-[#1C244B] bg-[#1C244B] text-white"
                              : "border-gray-200 text-gray-500 hover:border-gray-300"
                          }`}
                        >
                          {p.t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex gap-2 pt-1">
            <button
              onClick={speichern}
              disabled={laeuft}
              className="inline-flex items-center gap-2 text-sm font-600 px-4 py-2.5 rounded-xl bg-[#1C244B] text-white hover:bg-[#2A3563] transition-colors disabled:opacity-40"
            >
              {laeuft && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Speichern
            </button>
            <button
              type="button"
              onClick={() => setOffen(false)}
              className="text-sm font-600 px-4 py-2.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
