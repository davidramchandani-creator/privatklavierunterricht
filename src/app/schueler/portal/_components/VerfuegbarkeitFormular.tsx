"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, Loader2, Info, Star } from "lucide-react";
import { verfuegbarkeitSpeichern } from "../actions";

export type Tagesfenster = { wochentag: number; beginn: string; ende: string };

export type VorhandenesFenster = {
  wochentag: number;
  fruehestens: string;
  spaetestens: string;
  praeferenz: number;
};

const TAGE = [
  { nr: 1, kurz: "Mo", lang: "Montag" },
  { nr: 2, kurz: "Di", lang: "Dienstag" },
  { nr: 3, kurz: "Mi", lang: "Mittwoch" },
  { nr: 4, kurz: "Do", lang: "Donnerstag" },
  { nr: 5, kurz: "Fr", lang: "Freitag" },
];

type TagStand = {
  aktiv: boolean;
  von: string;
  bis: string;
  praeferenz: number;
};

function zeitOptionen(von: string, bis: string): string[] {
  const [vh, vm] = von.split(":").map(Number);
  const [bh, bm] = bis.split(":").map(Number);
  const out: string[] = [];
  for (let m = vh * 60 + vm; m <= bh * 60 + bm; m += 15) {
    out.push(
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
    );
  }
  return out;
}

function tagFrist(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Verfügbarkeitsabfrage im Portal.
 *
 * Bewusst so knapp wie möglich: Tag antippen, Zeitspanne wählen, fertig.
 * Je mehr Felder, desto weniger Leute füllen es aus — und ein Formular, das
 * niemand ausfüllt, ist schlechter als gar keins, weil die Planung dann auf
 * halben Daten aufsetzt.
 */
export default function VerfuegbarkeitFormular({
  runde,
  fenster,
  vorhanden,
  bemerkungVorhanden,
  bereitsGeantwortet,
}: {
  runde: { id: string; titel: string; frist: string };
  fenster: Tagesfenster[];
  vorhanden: VorhandenesFenster[];
  bemerkungVorhanden: string | null;
  bereitsGeantwortet: boolean;
}) {
  const router = useRouter();

  const [stand, setStand] = useState<Record<number, TagStand>>(() => {
    const init: Record<number, TagStand> = {};
    for (const t of TAGE) {
      const f = fenster.find((x) => x.wochentag === t.nr);
      const v = vorhanden.find((x) => x.wochentag === t.nr);
      init[t.nr] = {
        aktiv: v != null,
        von: v?.fruehestens ?? f?.beginn ?? "16:30",
        bis: v?.spaetestens ?? f?.ende ?? "20:30",
        praeferenz: v?.praeferenz ?? 2,
      };
    }
    return init;
  });

  const [bemerkung, setBemerkung] = useState(bemerkungVorhanden ?? "");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(bereitsGeantwortet);
  const [isPending, startTransition] = useTransition();

  const aktiveTage = TAGE.filter((t) => stand[t.nr].aktiv);

  function speichern() {
    setFehler(null);
    if (aktiveTage.length === 0) {
      setFehler("Bitte wähle mindestens einen Tag aus.");
      return;
    }
    for (const t of aktiveTage) {
      if (stand[t.nr].von >= stand[t.nr].bis) {
        setFehler(`${t.lang}: Das Ende liegt vor dem Beginn.`);
        return;
      }
    }

    startTransition(async () => {
      const res = await verfuegbarkeitSpeichern({
        rundeId: runde.id,
        fenster: aktiveTage.map((t) => ({
          wochentag: t.nr,
          fruehestens: stand[t.nr].von,
          spaetestens: stand[t.nr].bis,
          praeferenz: stand[t.nr].praeferenz,
        })),
        bemerkung: bemerkung.trim() || null,
      });
      if (res.error) {
        setFehler(res.error);
        return;
      }
      setGespeichert(true);
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#1C244B]/20 overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 bg-[#1C244B]/5 border-b border-[#1C244B]/10 flex items-start gap-2.5">
        <CalendarCheck className="w-4 h-4 text-[#1C244B] flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-600 text-[#1C244B]">{runde.titel}</p>
          <p className="text-sm text-gray-600 leading-snug mt-0.5">
            {gespeichert
              ? "Danke, deine Zeiten sind eingetragen. Du kannst sie bis zur Frist noch ändern."
              : `Bitte trage bis ${tagFrist(runde.frist)} ein, wann du kannst.`}
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className="rounded-xl bg-[#F3F5F8] p-3.5 flex gap-2.5">
          <Info className="w-4 h-4 text-[#1C244B] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600 leading-snug space-y-1.5">
            <p>
              Gib möglichst <strong>mehrere Zeitfenster</strong> an. Ich fahre zu
              allen Schülern und plane die Route so, dass möglichst wenig Leerfahrt
              entsteht — je mehr Auswahl ich habe, desto eher bekommst du eine
              Zeit, die dir wirklich passt.
            </p>
            <p className="text-gray-500">
              Mit dem Stern markierst du deine Wunschzeit. Wenn es die Route
              zulässt, bekommst du sie.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {TAGE.map((t) => {
            const f = fenster.find((x) => x.wochentag === t.nr);
            const s = stand[t.nr];
            if (!f) return null;

            return (
              <div
                key={t.nr}
                className={`rounded-xl border transition-colors ${
                  s.aktiv ? "border-[#1C244B]/30 bg-[#1C244B]/[0.03]" : "border-gray-200"
                }`}
              >
                <label className="flex items-center gap-3 p-3.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s.aktiv}
                    onChange={(e) =>
                      setStand((v) => ({
                        ...v,
                        [t.nr]: { ...v[t.nr], aktiv: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 rounded border-gray-300 text-[#1C244B] focus:ring-[#1C244B]"
                  />
                  <span className="font-600 text-gray-900 text-sm flex-1">
                    {t.lang}
                  </span>
                  <span className="text-xs text-gray-400">
                    {f.beginn}–{f.ende} möglich
                  </span>
                </label>

                {s.aktiv && (
                  <div className="px-3.5 pb-3.5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-10">von</span>
                      <select
                        value={s.von}
                        onChange={(e) =>
                          setStand((v) => ({
                            ...v,
                            [t.nr]: { ...v[t.nr], von: e.target.value },
                          }))
                        }
                        className="flex-1 rounded-lg border border-gray-200 px-2.5 min-h-[40px] text-sm focus:outline-none focus:border-[#1C244B]"
                      >
                        {zeitOptionen(f.beginn, f.ende).map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-gray-500 w-8 text-right">bis</span>
                      <select
                        value={s.bis}
                        onChange={(e) =>
                          setStand((v) => ({
                            ...v,
                            [t.nr]: { ...v[t.nr], bis: e.target.value },
                          }))
                        }
                        className="flex-1 rounded-lg border border-gray-200 px-2.5 min-h-[40px] text-sm focus:outline-none focus:border-[#1C244B]"
                      >
                        {zeitOptionen(f.beginn, f.ende).map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">Passt mir</span>
                      {[
                        { wert: 1, text: "zur Not" },
                        { wert: 2, text: "gut" },
                        { wert: 3, text: "am besten" },
                      ].map((p) => (
                        <button
                          key={p.wert}
                          type="button"
                          onClick={() =>
                            setStand((v) => ({
                              ...v,
                              [t.nr]: { ...v[t.nr], praeferenz: p.wert },
                            }))
                          }
                          className={`text-xs font-600 px-2.5 min-h-[32px] rounded-lg border transition-colors inline-flex items-center gap-1 ${
                            s.praeferenz === p.wert
                              ? "border-[#1C244B] bg-[#1C244B] text-white"
                              : "border-gray-200 text-gray-600"
                          }`}
                        >
                          {p.wert === 3 && <Star className="w-3 h-3" />}
                          {p.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-500 text-gray-600">
            Noch etwas, das ich wissen sollte? (freiwillig)
          </label>
          <textarea
            value={bemerkung}
            onChange={(e) => setBemerkung(e.target.value)}
            rows={2}
            placeholder="z. B. Ab Januar neu auch mittwochs möglich"
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#1C244B] resize-none"
          />
        </div>

        {fehler && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>
        )}

        <button
          onClick={speichern}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl min-h-[48px] hover:bg-[#151c3d] disabled:opacity-40 transition-colors"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Wird gespeichert…
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {gespeichert ? "Änderungen speichern" : "Zeiten absenden"}
            </>
          )}
        </button>

        {aktiveTage.length === 1 && (
          <p className="text-xs text-gray-400 text-center leading-snug">
            Nur ein Tag ausgewählt — mit mehreren findet sich eher eine Zeit, die
            dir wirklich passt.
          </p>
        )}
      </div>
    </div>
  );
}
