import { createClient } from "@/lib/supabase/server";
import { ladePlatzstatus } from "@/lib/platzstatus-server";
import { platzText, WENIGE_PLAETZE } from "@/lib/platzstatus";
import WartelisteBoard, { type Eintrag } from "./_components/WartelisteBoard";

export const dynamic = "force-dynamic";

export default async function AdminWartelistePage() {
  const supabase = await createClient();
  const [{ data }, status] = await Promise.all([
    supabase
      .from("warteliste")
      .select(
        "id, vorname, nachname, email, telefon, nachricht, wunsch_rhythmus, wunsch_tage, wunsch_zeiten, quelle, status, angebot_text, angebot_frist, angeboten_am, beantwortet_am, notizen, erstellt_am"
      )
      .order("erstellt_am", { ascending: true }),
    ladePlatzstatus(),
  ]);

  const hinweis = platzText(status);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">Warteliste</h1>
        <p className="text-sm text-gray-500 mt-1">
          Wer auf einen festen Platz wartet, in der Reihenfolge der Anmeldung.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-600 text-gray-400 uppercase tracking-wide">Freie Plätze</p>
          <p className="text-3xl font-800 text-[#1C244B] mt-1">{status.freiePlaetze}</p>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            Feste Termine alle zwei Wochen, die in den nächsten zwölf Wochen frei
            sind (wöchentlich zählt doppelt). Auf der Webseite steht{" "}
            {hinweis ? <strong>„{hinweis}“</strong> : <>nichts, solange es mehr als {WENIGE_PLAETZE} sind</>}.
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-600 text-gray-400 uppercase tracking-wide">Wartend</p>
          <p className="text-3xl font-800 text-[#1C244B] mt-1">{status.wartende}</p>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            Steht auf der Webseite, sobald jemand wartet. Wächst die Liste, ist das
            ein Zeichen, dass du die Preise für neue Schüler erhöhen kannst.
          </p>
        </div>
      </div>

      <WartelisteBoard eintraege={(data ?? []) as Eintrag[]} />
    </div>
  );
}
