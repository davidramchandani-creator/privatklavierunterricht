"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { antworteAufAngebot } from "../actions";

export default function AngebotAntwort({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState<string | null>(null);
  const [absagen, setAbsagen] = useState(false);
  const [bleiben, setBleiben] = useState(true);

  function antworten(zusage: boolean) {
    setFehler(null);
    startTransition(async () => {
      const r = await antworteAufAngebot(token, zusage, bleiben);
      if ("error" in r && r.error) setFehler(r.error);
      else if (zusage) setFertig("Super, danke! Ich melde mich in den nächsten Tagen bei dir und schicke dir alles Weitere.");
      else if (bleiben) setFertig("Danke für deine Antwort. Du bleibst auf der Warteliste, und ich melde mich beim nächsten freien Platz.");
      else setFertig("Danke für deine Antwort. Ich habe dich von der Warteliste genommen.");
    });
  }

  if (fertig) {
    return (
      <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-emerald-800">{fertig}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!absagen ? (
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => antworten(true)} disabled={isPending} className="flex-1">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ja, ich nehme den Platz"}
          </Button>
          <Button variant="outline" onClick={() => setAbsagen(true)} disabled={isPending} className="flex-1">
            Passt leider nicht
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={bleiben}
              onChange={(e) => setBleiben(e.target.checked)}
              className="w-4 h-4"
            />
            Auf der Warteliste bleiben
          </label>
          <div className="flex gap-3">
            <Button onClick={() => antworten(false)} disabled={isPending}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Absagen"}
            </Button>
            <Button variant="ghost" onClick={() => setAbsagen(false)} disabled={isPending}>
              Zurück
            </Button>
          </div>
        </div>
      )}
      {fehler && <p className="text-sm text-red-600">{fehler}</p>}
    </div>
  );
}
