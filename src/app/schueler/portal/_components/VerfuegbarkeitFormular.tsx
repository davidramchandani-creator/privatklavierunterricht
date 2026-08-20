"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, Loader2, Info, Star } from "lucide-react";
import { aboVorschau, verfuegbarkeitSpeichern } from "../actions";
import type { AboVariante } from "@/lib/abo";
import type { Rhythmus } from "@/lib/rhythmus";

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
 * Je mehr Felder, desto weniger Leute füllen es aus. Und ein Formular, das
 * niemand ausfüllt, ist schlechter als gar keins, weil die Planung dann auf
 * halben Daten aufsetzt.
 */
export default function VerfuegbarkeitFormular({
  runde,
  fenster,
  vorhanden,
  bemerkungVorhanden,
  bereitsGeantwortet,
  aboVarianteVorhanden,
  aboRhythmusVorhanden,
}: {
  runde: {
    id: string;
    titel: string;
    frist: string;
    art: "termine" | "umstellung";
    startDatum: string | null;
  };
  fenster: Tagesfenster[];
  vorhanden: VorhandenesFenster[];
  bemerkungVorhanden: string | null;
  bereitsGeantwortet: boolean;
  aboVarianteVorhanden?: AboVariante | null;
  aboRhythmusVorhanden?: Rhythmus | null;
}) {
  const router = useRouter();
  const umstellung = runde.art === "umstellung";

  // Nach dem Absenden zeigt die Karte die Wahl, nicht wieder das Formular.
  //
  // Vorher stand nach dem Speichern erneut das leere Formular da: Häkchen
  // zurückgesetzt, Knopf ausgegraut. Das las sich, als wäre nichts
  // angekommen, und wer sichergehen wollte, füllte alles ein zweites Mal
  // aus. Gespeichert war es längst.
  const [bearbeiten, setBearbeiten] = useState(false);

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

  // ── Abowahl, nur bei der Umstellung ──────────────────────
  const [variante, setVariante] = useState<AboVariante>(
    aboVarianteVorhanden ?? "halbjahr"
  );
  const [rhythmus, setRhythmus] = useState<Rhythmus>(
    aboRhythmusVorhanden ?? "woechentlich"
  );
  const [bestaetigt, setBestaetigt] = useState<Record<string, boolean>>({});
  const [vorschau, setVorschau] = useState<{
    lektionen: number;
    monatsbetrag: number;
    gesamtpreis: number;
    preisProLektion: number;
    periodeEnde: string;
    laufzeitMonate: number;
    ferientage: { tag: string; grund: string }[];
  } | null>(null);
  const [vorschauLaeuft, setVorschauLaeuft] = useState(false);

  const aktiveTage = TAGE.filter((t) => stand[t.nr].aktiv);
  const tageSchluessel = aktiveTage.map((t) => t.nr).join(",");

  // Vorschau serverseitig holen, sobald sich Wahl oder Tage ändern.
  //
  // Sie hängt von den Tagen ab, nicht nur vom Abo: Welche Ferien auf welchen
  // Wochentag fallen, entscheidet über die Lektionszahl und damit über den
  // Preis. Gerechnet wird mit dem ungünstigsten der angegebenen Tage, sonst
  // stünde in der Vorschau eine Zahl, die sich nach der Zuteilung nicht mehr
  // halten liesse.
  useEffect(() => {
    if (!umstellung || aktiveTage.length === 0) {
      setVorschau(null);
      return;
    }
    let abgebrochen = false;
    setVorschauLaeuft(true);
    (async () => {
      const res = await aboVorschau({
        variante,
        rhythmus,
        bookingMode: "fix",
        moeglicheTage: tageSchluessel.split(",").map(Number),
        rundeId: runde.id,
      });
      if (abgebrochen) return;
      setVorschauLaeuft(false);
      if ("error" in res) {
        setVorschau(null);
        return;
      }
      setVorschau({
        lektionen: res.vorschau.lektionen,
        monatsbetrag: res.vorschau.monatsbetrag,
        gesamtpreis: res.vorschau.gesamtpreis,
        preisProLektion: res.vorschau.preisProLektion,
        periodeEnde: res.vorschau.periodeEnde,
        laufzeitMonate: res.vorschau.laufzeitMonate,
        ferientage: res.vorschau.ferientage,
      });
    })();
    return () => {
      abgebrochen = true;
    };
  }, [umstellung, variante, rhythmus, tageSchluessel, runde.id, aktiveTage.length]);

  const PUNKTE = [
    {
      id: "laufzeit",
      text: vorschau
        ? `Mein Abo läuft vom ${tagFrist(runde.startDatum ?? "")} bis ${tagFrist(vorschau.periodeEnde)} und umfasst ${vorschau.lektionen} Lektionen.`
        : "Ich kenne Laufzeit und Lektionszahl meines Abos.",
    },
    {
      id: "ferien",
      text: "In den Schulferien findet kein Unterricht statt. Diese Wochen sind bereits abgezogen, ich zahle nichts dafür und bekomme dafür auch keinen Ersatz.",
    },
    {
      id: "termin",
      text: "Meinen festen Termin bekomme ich zugeteilt, ich suche ihn nicht selbst aus. Er liegt in einem der Zeitfenster, die ich angebe.",
    },
    {
      id: "zahlung",
      text: vorschau
        ? `Ich zahle CHF ${vorschau.monatsbetrag.toFixed(2)} pro Monat über ${vorschau.laufzeitMonate} Monate, unabhängig davon, wie viele Lektionen in den einzelnen Monat fallen.`
        : "Ich zahle einen gleichbleibenden Monatsbetrag über die ganze Laufzeit.",
    },
    {
      id: "absage",
      text: "Wenn ich einmal nicht kann, sage ich spätestens 24 Stunden vorher ab. Danach verfällt die Lektion.",
    },
  ];

  const alleBestaetigt = !umstellung || PUNKTE.every((p) => bestaetigt[p.id]);

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
    if (umstellung && !alleBestaetigt) {
      setFehler("Bitte bestätige alle Punkte.");
      return;
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
        aboVariante: umstellung ? variante : null,
        aboRhythmus: umstellung ? rhythmus : null,
      });
      if (res.error) {
        setFehler(res.error);
        return;
      }
      setGespeichert(true);
      setBearbeiten(false);
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
              ? umstellung
                ? "Danke, deine Wahl ist gespeichert. Du kannst sie bis zur Frist noch ändern."
                : "Danke, deine Zeiten sind eingetragen. Du kannst sie bis zur Frist noch ändern."
              : umstellung
                ? `Bitte wähle bis ${tagFrist(runde.frist)} dein Abo und trage ein, wann du kannst.`
                : `Bitte trage bis ${tagFrist(runde.frist)} ein, wann du kannst.`}
          </p>
        </div>
      </div>

      {/* Gespeicherte Wahl anzeigen statt das Formular erneut. */}
      {gespeichert && !bearbeiten ? (
        <div className="p-4 sm:p-5 space-y-3">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex gap-3">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 text-sm text-emerald-900 leading-snug space-y-1">
              {umstellung && (
                <p className="font-600">
                  {variante === "jahr" ? "Jahresabo" : "Halbjahresabo"},{" "}
                  {rhythmus === "zweiwoechentlich"
                    ? "alle zwei Wochen"
                    : "jede Woche"}
                </p>
              )}
              <p>
                Deine Zeiten:{" "}
                {aktiveTage
                  .map((t) => `${t.kurz} ${stand[t.nr].von}–${stand[t.nr].bis}`)
                  .join(", ") || "eingetragen"}
              </p>
              <p className="text-emerald-700">
                Alles angekommen. Deinen festen Termin bekommst du nach dem{" "}
                {tagFrist(runde.frist)} per Mail.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setBearbeiten(true)}
            className="text-sm font-600 text-[#1C244B] underline underline-offset-2"
          >
            Wahl ändern
          </button>
        </div>
      ) : (
      <div className="p-4 sm:p-5 space-y-4">
        {umstellung && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-600 text-gray-900 mb-2">
                1. Wie lange möchtest du buchen?
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      wert: "halbjahr" as const,
                      titel: "Halbjahr",
                      dauer: "6 Monate",
                    },
                    {
                      wert: "jahr" as const,
                      titel: "Jahr",
                      dauer: "12 Monate",
                      hinweis: "günstiger pro Lektion",
                    },
                  ]
                ).map((o) => (
                  <button
                    key={o.wert}
                    type="button"
                    onClick={() => setVariante(o.wert)}
                    className={`text-left rounded-xl border p-3.5 transition-colors ${
                      variante === o.wert
                        ? "border-[#1C244B] bg-[#1C244B]/[0.04]"
                        : "border-gray-200"
                    }`}
                  >
                    <span className="block font-600 text-sm text-gray-900">
                      {o.titel}
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      {o.dauer}
                    </span>
                    {o.hinweis && (
                      <span className="block text-xs text-emerald-600 font-500 mt-1">
                        {o.hinweis}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-600 text-gray-900 mb-2">
                2. Wie oft möchtest du kommen?
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {(
                  [
                    { wert: "woechentlich" as const, titel: "Jede Woche" },
                    {
                      wert: "zweiwoechentlich" as const,
                      titel: "Alle zwei Wochen",
                    },
                  ]
                ).map((o) => (
                  <button
                    key={o.wert}
                    type="button"
                    onClick={() => setRhythmus(o.wert)}
                    className={`text-left rounded-xl border p-3.5 transition-colors ${
                      rhythmus === o.wert
                        ? "border-[#1C244B] bg-[#1C244B]/[0.04]"
                        : "border-gray-200"
                    }`}
                  >
                    <span className="block font-600 text-sm text-gray-900">
                      {o.titel}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2 leading-snug">
                Der Preis pro Lektion ist in beiden Fällen gleich. Wer alle zwei
                Wochen kommt, hat halb so viele Lektionen und zahlt halb so viel
                im Monat.
              </p>
            </div>

            <p className="text-sm font-600 text-gray-900 pt-1">
              3. Wann kannst du?
            </p>
          </div>
        )}

        <div className="rounded-xl bg-[#F3F5F8] p-3.5 flex gap-2.5">
          <Info className="w-4 h-4 text-[#1C244B] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600 leading-snug space-y-1.5">
            <p>
              Gib möglichst <strong>mehrere Zeitfenster</strong> an. Ich fahre zu
              allen Schülern und plane die Route so, dass möglichst wenig Leerfahrt
              entsteht, je mehr Auswahl ich habe, desto eher bekommst du eine
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
                    {f.beginn}, {f.ende} möglich
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

        {umstellung && (
          <div className="space-y-4 pt-1">
            <div>
              <p className="text-sm font-600 text-gray-900 mb-2">
                4. Das kommt dabei heraus
              </p>

              {aktiveTage.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 p-4">
                  <p className="text-sm text-gray-500 leading-snug">
                    Wähle oben mindestens einen Tag, dann rechne ich dir deine
                    Lektionszahl und deinen Monatsbeitrag aus.
                  </p>
                </div>
              ) : vorschau ? (
                <div className="rounded-xl bg-[#1C244B]/[0.04] border border-[#1C244B]/15 p-4 space-y-2.5">
                  {[
                    {
                      k: "Laufzeit",
                      v: `${tagFrist(runde.startDatum ?? "")} bis ${tagFrist(vorschau.periodeEnde)}`,
                    },
                    { k: "Lektionen", v: `${vorschau.lektionen} à 45 Minuten` },
                    {
                      k: "Pro Lektion",
                      v: `CHF ${vorschau.preisProLektion.toFixed(2)}`,
                    },
                  ].map((z) => (
                    <div key={z.k} className="flex justify-between gap-3">
                      <span className="text-sm text-gray-500">{z.k}</span>
                      <span className="text-sm font-600 text-gray-900 text-right">
                        {z.v}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 pt-2.5 border-t border-[#1C244B]/10">
                    <span className="text-sm text-gray-500">Pro Monat</span>
                    <span className="text-base font-700 text-[#1C244B]">
                      CHF {vorschau.monatsbetrag.toFixed(2)}
                    </span>
                  </div>

                  {vorschau.ferientage.length > 0 && (
                    <p className="text-xs text-gray-500 leading-snug pt-1.5">
                      {vorschau.ferientage.length}{" "}
                      {vorschau.ferientage.length === 1 ? "Termin fällt" : "Termine fallen"}{" "}
                      in die Schulferien. Bereits abgezogen, du zahlst nichts
                      dafür.
                    </p>
                  )}

                  {vorschauLaeuft && (
                    <p className="text-xs text-gray-400">Wird neu gerechnet…</p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm text-gray-500 inline-flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Wird gerechnet…
                  </p>
                </div>
              )}

              {vorschau && (
                <p className="text-xs text-gray-400 mt-2 leading-snug">
                  Die Lektionszahl gilt für den ungünstigsten deiner
                  angegebenen Tage. Fällt dein Termin auf einen Tag mit einer
                  Lektion mehr, bleibt der Preis derselbe.
                </p>
              )}
            </div>

            {vorschau && (
              <div>
                <p className="text-sm font-600 text-gray-900 mb-2">
                  5. Bitte einzeln bestätigen
                </p>
                <div className="space-y-2">
                  {PUNKTE.map((p) => (
                    <label
                      key={p.id}
                      className={`flex gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        bestaetigt[p.id]
                          ? "border-[#1C244B]/30 bg-[#1C244B]/[0.03]"
                          : "border-gray-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={bestaetigt[p.id] ?? false}
                        onChange={(e) =>
                          setBestaetigt((v) => ({ ...v, [p.id]: e.target.checked }))
                        }
                        className="w-4 h-4 mt-0.5 rounded border-gray-300 text-[#1C244B] focus:ring-[#1C244B] flex-shrink-0"
                      />
                      <span className="text-sm text-gray-700 leading-snug">
                        {p.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {fehler && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>
        )}

        <button
          onClick={speichern}
          disabled={isPending || !alleBestaetigt}
          className="w-full flex items-center justify-center gap-2 bg-[#1C244B] text-white font-600 text-sm rounded-xl min-h-[48px] hover:bg-[#151c3d] disabled:opacity-40 transition-colors"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Wird gespeichert…
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              {gespeichert
                ? "Änderungen speichern"
                : umstellung
                  ? "Abo und Zeiten absenden"
                  : "Zeiten absenden"}
            </>
          )}
        </button>

        {aktiveTage.length === 1 && (
          <p className="text-xs text-gray-400 text-center leading-snug">
            Nur ein Tag ausgewählt, mit mehreren findet sich eher eine Zeit, die
            dir wirklich passt.
          </p>
        )}
      </div>
      )}
    </div>
  );
}
