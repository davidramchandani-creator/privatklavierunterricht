"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Car, Loader2 } from "lucide-react";
import { planungSchalterSetzen } from "@/app/admin/actions";

/**
 * Zwei Schalter, die oft verwechselt werden — darum stehen sie zusammen
 * und mit ausgeschriebener Folge statt als blosse Haken.
 *
 *   Zuteilung   Sucht der Planer diesem Schüler einen Platz?
 *   Hausbesuch  Fahre ich hin, oder kommt er zu mir?
 *
 * Was beide **nicht** tun: den Schüler verstecken. Sein bestehender Termin
 * bleibt im Kalender und belegt seine Zeit. Vorher gab es dafür nur
 * „inaktiv", und das nahm ihn auch aus Zahlungen und Abrechnung.
 */
type Feld = "planung_aktiv" | "hausbesuch";

/**
 * Ausserhalb der Elternkomponente definiert, nicht im Render.
 *
 * Sonst entsteht bei jedem Zustandswechsel ein neuer Komponententyp, React
 * wirft den alten Baum weg und baut ihn neu auf — beim Umschalten würde
 * die Animation springen und der Fokus verlorengehen.
 */
function Zeile({
  an,
  icon,
  titel,
  anText,
  ausText,
  laeuft,
  dran,
  onToggle,
}: {
  an: boolean;
  icon: React.ReactNode;
  titel: string;
  anText: string;
  ausText: string;
  laeuft: boolean;
  dran: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className={`mt-0.5 ${an ? "text-[#1C244B]" : "text-gray-300"}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-600 text-gray-900">{titel}</p>
        <p className="text-xs text-gray-500 leading-snug mt-0.5">
          {an ? anText : ausText}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={an}
        aria-label={titel}
        disabled={laeuft}
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
          an ? "bg-[#1C244B]" : "bg-gray-200"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all flex items-center justify-center ${
            an ? "left-[22px]" : "left-0.5"
          }`}
        >
          {dran && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
        </span>
      </button>
    </div>
  );
}

export default function PlanungSchalter({
  studentId,
  planungAktiv,
  hausbesuch,
}: {
  studentId: string;
  planungAktiv: boolean;
  hausbesuch: boolean;
}) {
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [welcher, setWelcher] = useState<Feld | null>(null);

  function umschalten(feld: Feld, wert: boolean) {
    setFehler(null);
    setWelcher(feld);
    starte(async () => {
      const res = await planungSchalterSetzen(studentId, feld, wert);
      if ("error" in res && res.error) setFehler(res.error);
      setWelcher(null);
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h2 className="text-lg font-700 text-[#1C244B] mb-1">Planung</h2>
      <p className="text-xs text-gray-500 mb-2">
        Beides ändert nichts an bestehenden Terminen — die bleiben im
        Kalender und belegen ihre Zeit.
      </p>

      {fehler && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3.5 py-2.5 my-3">
          {fehler}
        </p>
      )}

      <div className="divide-y divide-gray-100">
        <Zeile
          an={planungAktiv}
          laeuft={laeuft}
          dran={welcher === "planung_aktiv"}
          onToggle={() => umschalten("planung_aktiv", !planungAktiv)}
          icon={<CalendarOff className="w-4 h-4" />}
          titel="Nimmt an der Zuteilung teil"
          anText="Der Planer sucht ihm in jeder Runde einen Platz."
          ausText="Der Planer lässt ihn aus und fragt ihn nicht nach Zeiten. Sein bisheriger Termin bleibt bestehen und blockiert weiter."
        />
        <Zeile
          an={hausbesuch}
          laeuft={laeuft}
          dran={welcher === "hausbesuch"}
          onToggle={() => umschalten("hausbesuch", !hausbesuch)}
          icon={<Car className="w-4 h-4" />}
          titel="Ich fahre hin"
          anText="Hausbesuch — die Fahrzeit zählt in der Route."
          ausText="Er kommt zu dir oder es läuft online. Die Lektion belegt Zeit, kostet aber keine Fahrt."
        />
      </div>
    </div>
  );
}
