"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { platzText, platzstufe, WENIGE_PLAETZE } from "@/lib/platzstatus";
import { freiePlaetzeSpeichern } from "../actions";

/**
 * Freie Plätze selbst eintragen. Die gerechnete Zahl steht daneben als
 * Vorschlag, zählt aber nur, wenn der Schalter auf „automatisch“ steht.
 */
export default function FreiePlaetze({
  manuell,
  freie,
  zusatz,
  automatisch,
  wartende,
}: {
  manuell: boolean;
  freie: number;
  zusatz: string | null;
  automatisch: number;
  wartende: number;
}) {
  const [selbst, setSelbst] = useState(manuell);
  const [zahl, setZahl] = useState(String(manuell ? freie : automatisch));
  const [text, setText] = useState(zusatz ?? "");
  const [isPending, startTransition] = useTransition();
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  const wert = selbst ? Math.max(0, Math.round(Number(zahl) || 0)) : automatisch;
  const vorschau = platzText({
    freiePlaetze: wert,
    wartende,
    stufe: platzstufe(wert),
    zusatz: selbst ? text.trim() || null : null,
  });

  function speichern() {
    setMeldung(null);
    startTransition(async () => {
      const r = await freiePlaetzeSpeichern(selbst, Number(zahl) || 0, text);
      if (r && "error" in r && r.error) setMeldung({ ok: false, text: r.error });
      else setMeldung({ ok: true, text: "Gespeichert. Die Webseite zeigt es ab sofort." });
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-600 text-gray-400 uppercase tracking-wide">Freie Plätze</p>
          <p className="text-3xl font-800 text-[#1C244B] mt-1">{wert}</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs font-600">
          <button
            type="button"
            onClick={() => setSelbst(true)}
            className={`px-3 py-1.5 rounded-md transition-colors ${selbst ? "bg-[#1C244B] text-white" : "text-gray-500"}`}
          >
            Selbst
          </button>
          <button
            type="button"
            onClick={() => setSelbst(false)}
            className={`px-3 py-1.5 rounded-md transition-colors ${!selbst ? "bg-[#1C244B] text-white" : "text-gray-500"}`}
          >
            Automatisch
          </button>
        </div>
      </div>

      {selbst ? (
        <div className="space-y-3">
          <div className="grid grid-cols-[90px_1fr] gap-2">
            <div>
              <label className="text-xs font-600 text-gray-600 block mb-1">Anzahl</label>
              <Input
                type="number"
                min={0}
                max={99}
                value={zahl}
                onChange={(e) => setZahl(e.target.value)}
                className="h-10"
              />
            </div>
            <div>
              <label className="text-xs font-600 text-gray-600 block mb-1">Zusatz (freiwillig)</label>
              <Input
                value={text}
                maxLength={60}
                onChange={(e) => setText(e.target.value)}
                placeholder="z. B. ab Februar, nur Freitag"
                className="h-10"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Vorschlag aus deinen Zeitfenstern: <strong>{automatisch}</strong>{" "}
            <button
              type="button"
              onClick={() => setZahl(String(automatisch))}
              className="underline underline-offset-2 hover:text-[#1C244B]"
            >
              übernehmen
            </button>
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-500 leading-relaxed">
          Gerechnet aus deinen Zeitfenstern: feste Termine alle zwei Wochen, die in den nächsten
          zwölf Wochen frei sind (wöchentlich zählt doppelt).
        </p>
      )}

      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        Auf der Webseite:{" "}
        {vorschau ? <strong className="text-gray-800">„{vorschau}“</strong> : <>kein Hinweis (mehr als {WENIGE_PLAETZE} frei)</>}
        {wert === 0 && " · Probelektion führt zur Warteliste"}
      </p>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={speichern} disabled={isPending}>
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Speichern"}
        </Button>
        {meldung && (
          <span className={`text-xs ${meldung.ok ? "text-emerald-600" : "text-red-600"}`}>{meldung.text}</span>
        )}
      </div>
    </div>
  );
}
