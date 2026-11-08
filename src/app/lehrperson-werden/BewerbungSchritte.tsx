"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Loader2, Music, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALTERSGRUPPEN, MOBILITAET, ORTE, PENSUM, STILE, TAGE, ZEITFENSTER, ANGEBOT } from "@/lib/bewerbung";
import { bewerben } from "./actions";

type Werte = Record<string, unknown> & {
  verfuegbarkeit: Record<string, string[]>;
  stile: string[];
  altersgruppen: string[];
  unterrichtsorte: string[];
  mobilitaet: string[];
};

const SCHRITTE = [
  { titel: "Du und das Klavier", untertitel: "Erzähl mir, woher deine Musik kommt." },
  { titel: "Du als Lehrperson", untertitel: "Wie du unterrichtest, interessiert mich mehr als jedes Diplom." },
  { titel: "Wann und wo", untertitel: "Damit ich sehe, welche Schüler zu dir passen." },
  { titel: "Fast geschafft", untertitel: "Noch deine Kontaktdaten, dann ist es geschafft." },
];

function Chip({ aktiv, onClick, children }: { aktiv: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press text-sm rounded-full px-4 py-2 border transition-all ${
        aktiv ? "bg-navy-900 text-white border-navy-900 shadow-sm" : "bg-white text-gray-700 border-[#EAECEF] hover:border-navy-300"
      }`}
    >
      {children}
    </button>
  );
}

function Frage({ label, hinweis, children }: { label: string; hinweis?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-700 text-navy-900">{label}</p>
      {children}
      {hinweis && <p className="text-xs text-gray-400">{hinweis}</p>}
    </div>
  );
}

const textareaKlasse =
  "w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function BewerbungSchritte() {
  const [schritt, setSchritt] = useState(0);
  const [fertig, setFertig] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [w, setW] = useState<Werte>({
    verfuegbarkeit: {},
    stile: [],
    altersgruppen: [],
    unterrichtsorte: [],
    mobilitaet: [],
    start_ab: ANGEBOT.start,
  });

  const setze = (k: string, v: unknown) => setW((alt) => ({ ...alt, [k]: v }));
  const umschalten = (k: "stile" | "altersgruppen" | "unterrichtsorte" | "mobilitaet", wert: string) =>
    setW((alt) => ({
      ...alt,
      [k]: alt[k].includes(wert) ? alt[k].filter((x) => x !== wert) : [...alt[k], wert],
    }));
  const fenster = (tag: string, f: string) =>
    setW((alt) => {
      const bisher = alt.verfuegbarkeit[tag] ?? [];
      const neu = bisher.includes(f) ? bisher.filter((x) => x !== f) : [...bisher, f];
      return { ...alt, verfuegbarkeit: { ...alt.verfuegbarkeit, [tag]: neu } };
    });
  const s = (k: string) => (typeof w[k] === "string" ? (w[k] as string) : "");

  function pruefeSchritt(): string | null {
    if (schritt === 2) {
      const n = Object.values(w.verfuegbarkeit).reduce((a, f) => a + f.length, 0);
      if (n === 0) return "Bitte kreuz mindestens ein Zeitfenster an.";
      if (w.unterrichtsorte.length === 0) return "Wo möchtest du unterrichten?";
    }
    return null;
  }

  function weiter() {
    const f = pruefeSchritt();
    setFehler(f);
    if (!f) {
      setSchritt((x) => x + 1);
      window.scrollTo({ top: document.getElementById("bewerbung")?.offsetTop ?? 0, behavior: "smooth" });
    }
  }

  function absenden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    startTransition(async () => {
      const r = await bewerben(w);
      if ("error" in r && r.error) setFehler(r.error);
      else setFertig(true);
    });
  }

  if (fertig) {
    return (
      <div className="text-center space-y-4 py-8 animate-enter-up">
        <div className="w-16 h-16 bg-navy-900 rounded-2xl flex items-center justify-center mx-auto rotate-3">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-2xl font-800 text-navy-900">Danke, {s("vorname")}!</h3>
        <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
          Deine Bewerbung ist bei mir. Du bekommst gleich eine Bestätigung per Mail, und ich melde mich
          innert einer Woche bei dir.
        </p>
      </div>
    );
  }

  const fortschritt = ((schritt + 1) / SCHRITTE.length) * 100;

  return (
    <form onSubmit={absenden} className="space-y-6">
      {/* Fortschritt */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-600 text-gray-400">
          <span>
            Schritt {schritt + 1} von {SCHRITTE.length}
          </span>
          <span>ca. 5 Minuten</span>
        </div>
        <div className="h-2 bg-navy-50 rounded-full overflow-hidden">
          <div className="h-full bg-navy-900 rounded-full transition-all duration-500" style={{ width: `${fortschritt}%` }} />
        </div>
      </div>

      <div key={schritt} className="space-y-6 animate-enter-up">
        <div>
          <h3 className="text-2xl font-800 text-navy-900">{SCHRITTE[schritt].titel}</h3>
          <p className="text-gray-500 mt-1">{SCHRITTE[schritt].untertitel}</p>
        </div>

        {schritt === 0 && (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <Frage label="Vorname">
                <Input value={s("vorname")} onChange={(e) => setze("vorname", e.target.value)} required autoComplete="given-name" />
              </Frage>
              <Frage label="Nachname">
                <Input value={s("nachname")} onChange={(e) => setze("nachname", e.target.value)} required autoComplete="family-name" />
              </Frage>
            </div>
            <Frage label="Seit wann spielst du Klavier?">
              <Input type="number" min={1950} max={new Date().getFullYear()} placeholder="z. B. 2010" value={s("spielt_seit")} onChange={(e) => setze("spielt_seit", e.target.value)} className="max-w-[160px]" />
            </Frage>
            <Frage label="Was spielst du am liebsten?" hinweis="Mehrere möglich.">
              <div className="flex flex-wrap gap-2">
                {STILE.map((st) => (
                  <Chip key={st} aktiv={w.stile.includes(st)} onClick={() => umschalten("stile", st)}>
                    {st}
                  </Chip>
                ))}
              </div>
            </Frage>
            <Frage label="Welcher Song hat dich ans Klavier gebracht?">
              <div className="relative">
                <Music className="w-4 h-4 text-navy-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input value={s("lieblingssong")} onChange={(e) => setze("lieblingssong", e.target.value)} placeholder="Titel, Interpret, oder einfach die Geschichte dazu" className="pl-9" />
              </div>
            </Frage>
          </>
        )}

        {schritt === 1 && (
          <>
            <Frage label="Hast du schon unterrichtet?">
              <div className="flex flex-wrap gap-2">
                {[
                  ["keine", "Noch nicht"],
                  ["etwas", "Ein bisschen"],
                  ["viel", "Ja, regelmässig"],
                ].map(([k, l]) => (
                  <Chip key={k} aktiv={w.unterrichtserfahrung === k} onClick={() => setze("unterrichtserfahrung", k)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </Frage>
            {w.unterrichtserfahrung && w.unterrichtserfahrung !== "keine" && (
              <Frage label="Erzähl kurz, wen und wie lange.">
                <textarea rows={2} className={textareaKlasse} value={s("unterrichtserfahrung_text")} onChange={(e) => setze("unterrichtserfahrung_text", e.target.value)} />
              </Frage>
            )}
            <Frage label="Ausbildung oder Studium" hinweis="Kein Diplom nötig. Ein Musik- oder PH-Studium ist willkommen.">
              <Input value={s("ausbildung")} onChange={(e) => setze("ausbildung", e.target.value)} placeholder="z. B. PH Zürich, 3. Semester, oder: Musikschule bis 18" />
            </Frage>
            <Frage label="Wen unterrichtest du am liebsten?">
              <div className="flex flex-wrap gap-2">
                {ALTERSGRUPPEN.map((a) => (
                  <Chip key={a.key} aktiv={w.altersgruppen.includes(a.key)} onClick={() => umschalten("altersgruppen", a.key)}>
                    {a.label}
                  </Chip>
                ))}
              </div>
            </Frage>
            <Frage label="Kleine Aufgabe: Wie erklärst du einer 9-Jährigen, was ein Akkord ist?" hinweis="Zwei, drei Sätze genügen. Es gibt kein richtig oder falsch.">
              <textarea rows={3} className={textareaKlasse} value={s("akkord_erklaerung")} onChange={(e) => setze("akkord_erklaerung", e.target.value)} />
            </Frage>
            <Frage label="Was ist dir im Unterricht am wichtigsten?">
              <textarea rows={2} className={textareaKlasse} value={s("wichtig_im_unterricht")} onChange={(e) => setze("wichtig_im_unterricht", e.target.value)} />
            </Frage>
          </>
        )}

        {schritt === 2 && (
          <>
            <Frage label="Wann hättest du Zeit?" hinweis="Tipp auf die Felder. Grob reicht, wir stimmen es später genau ab.">
              <div className="overflow-x-auto">
                <table className="text-sm">
                  <thead>
                    <tr>
                      <th />
                      {TAGE.map((t) => (
                        <th key={t.key} className="px-1 pb-2 font-600 text-gray-500 text-center">
                          {t.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ZEITFENSTER.map((z) => (
                      <tr key={z.key}>
                        <td className="pr-3 py-1 text-xs text-gray-500 whitespace-nowrap">{z.label}</td>
                        {TAGE.map((t) => {
                          const an = (w.verfuegbarkeit[t.key] ?? []).includes(z.key);
                          return (
                            <td key={t.key} className="p-1">
                              <button
                                type="button"
                                aria-label={`${t.label} ${z.label}`}
                                onClick={() => fenster(t.key, z.key)}
                                className={`w-11 h-9 rounded-lg border transition-all ${an ? "bg-navy-900 border-navy-900 scale-105" : "bg-white border-[#EAECEF] hover:border-navy-300"}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Frage>
            <Frage label="Wo möchtest du unterrichten?">
              <div className="flex flex-wrap gap-2">
                {ORTE.map((o) => (
                  <Chip key={o.key} aktiv={w.unterrichtsorte.includes(o.key)} onClick={() => umschalten("unterrichtsorte", o.key)}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </Frage>
            <div className="grid sm:grid-cols-2 gap-4">
              <Frage label="Wo wohnst du?" hinweis="Ort oder Quartier genügt.">
                <Input value={s("wohnort")} onChange={(e) => setze("wohnort", e.target.value)} placeholder="z. B. Winterthur Veltheim" />
              </Frage>
              <Frage label="Wie bist du unterwegs?">
                <div className="flex flex-wrap gap-2">
                  {MOBILITAET.map((m) => (
                    <Chip key={m.key} aktiv={w.mobilitaet.includes(m.key)} onClick={() => umschalten("mobilitaet", m.key)}>
                      {m.label}
                    </Chip>
                  ))}
                </div>
              </Frage>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Frage label="Wie viele Lektionen pro Woche möchtest du?">
                <div className="flex flex-wrap gap-2">
                  {PENSUM.map((p) => (
                    <Chip key={p} aktiv={w.lektionen_pro_woche === p} onClick={() => setze("lektionen_pro_woche", p)}>
                      {p}
                    </Chip>
                  ))}
                </div>
              </Frage>
              <Frage label="Ab wann?">
                <Input type="date" value={s("start_ab")} onChange={(e) => setze("start_ab", e.target.value)} className="max-w-[200px]" />
              </Frage>
            </div>
          </>
        )}

        {schritt === 3 && (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <Frage label="E-Mail">
                <Input type="email" value={s("email")} onChange={(e) => setze("email", e.target.value)} required autoComplete="email" />
              </Frage>
              <Frage label="Telefon">
                <Input type="tel" value={s("telefon")} onChange={(e) => setze("telefon", e.target.value)} autoComplete="tel" />
              </Frage>
            </div>
            <Frage label="Bist du 20 oder älter?" hinweis="Unter 20 hast du gesetzlich eine Woche mehr Ferien, das rechne ich beim Lohn ein.">
              <div className="flex gap-2">
                <Chip aktiv={w.mindestens_20 === true} onClick={() => setze("mindestens_20", true)}>
                  Ja
                </Chip>
                <Chip aktiv={w.mindestens_20 === false} onClick={() => setze("mindestens_20", false)}>
                  Nein
                </Chip>
              </div>
            </Frage>
            <label className="flex items-start gap-3 bg-navy-50 rounded-xl p-4 text-sm text-navy-900 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4" checked={w.leitbild_passt === true} onChange={(e) => setze("leitbild_passt", e.target.checked)} />
              <span>
                <strong>Beziehung vor Programm:</strong> Mir ist wichtig, dass sich meine Schüler wohlfühlen, und ich
                passe meinen Unterricht lieber dem Menschen an als umgekehrt.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4" checked={w.datenschutz === true} onChange={(e) => setze("datenschutz", e.target.checked)} />
              <span>
                Ich bin einverstanden, dass David meine Angaben für die Bewerbung speichert. Sie werden nicht
                weitergegeben und auf Wunsch gelöscht.
              </span>
            </label>
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute left-[-9999px] w-px h-px opacity-0"
              value={s("firma")}
              onChange={(e) => setze("firma", e.target.value)}
            />
          </>
        )}
      </div>

      {fehler && <p className="text-sm text-red-600">{fehler}</p>}

      <div className="flex items-center justify-between gap-3 pt-2">
        {schritt > 0 ? (
          <Button type="button" variant="ghost" onClick={() => setSchritt((x) => x - 1)}>
            <ArrowLeft className="w-4 h-4" /> Zurück
          </Button>
        ) : (
          <span />
        )}
        {schritt < SCHRITTE.length - 1 ? (
          <Button
            type="button"
            onClick={weiter}
            disabled={schritt === 0 && (!s("vorname") || !s("nachname"))}
          >
            Weiter <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button type="submit" disabled={isPending || !s("email") || w.datenschutz !== true}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Bewerbung abschicken"}
          </Button>
        )}
      </div>
    </form>
  );
}
