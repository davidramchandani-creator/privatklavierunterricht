"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EinfacherText from "@/components/EinfacherText";
import { leitbildVeroeffentlichen } from "../lehrpersonen/actions";

export default function LeitbildEditor({ titel, inhalt, neueVersion }: { titel: string; inhalt: string; neueVersion: number }) {
  const router = useRouter();
  const [t, setT] = useState(titel);
  const [text, setText] = useState(inhalt);
  const [vorschau, setVorschau] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  const geaendert = text.trim() !== inhalt.trim() || t.trim() !== titel.trim();

  function veroeffentlichen() {
    if (!confirm(`Version ${neueVersion} veröffentlichen? Alle Lehrpersonen müssen sie dann neu bestätigen.`)) return;
    setMeldung(null);
    startTransition(async () => {
      const r = await leitbildVeroeffentlichen(t, text);
      if ("error" in r && r.error) setMeldung({ ok: false, text: r.error });
      else {
        setMeldung({ ok: true, text: `Version ${neueVersion} ist veröffentlicht.` });
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-700 text-[#1C244B]">{inhalt ? "Neue Version schreiben" : "Erstes Leitbild schreiben"}</p>
        <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs font-600">
          <button type="button" onClick={() => setVorschau(false)} className={`px-3 py-1.5 rounded-md ${!vorschau ? "bg-[#1C244B] text-white" : "text-gray-500"}`}>
            Schreiben
          </button>
          <button type="button" onClick={() => setVorschau(true)} className={`px-3 py-1.5 rounded-md ${vorschau ? "bg-[#1C244B] text-white" : "text-gray-500"}`}>
            Vorschau
          </button>
        </div>
      </div>
      <Input value={t} onChange={(e) => setT(e.target.value)} placeholder="Titel" />
      {vorschau ? (
        <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-700 min-h-[240px]">
          <EinfacherText text={text} />
        </div>
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1C244B]/20"
          placeholder={"## Wofür wir stehen\nUnterricht mit Gefühl und Verstand.\n\n## Was ich von dir erwarte\n- Pünktlich und vorbereitet\n- **Kein** direkter Kontakt zu Kunden über Preise oder Termine"}
        />
      )}
      <p className="text-xs text-gray-400">
        Formatierung: ## Überschrift, - Aufzählung, **fett**, *kursiv*, Leerzeile für einen neuen Absatz.
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={veroeffentlichen} disabled={isPending || !geaendert || text.trim().length < 20}>
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Als Version ${neueVersion} veröffentlichen`}
        </Button>
        {meldung && <span className={`text-sm ${meldung.ok ? "text-emerald-600" : "text-red-600"}`}>{meldung.text}</span>}
      </div>
    </div>
  );
}
