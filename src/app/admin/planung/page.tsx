import { createAdminClient } from "@/lib/supabase/server";
import { ladeAntwortStand, ladeOffeneRunde } from "@/lib/planung-server";
import { ladeFenster } from "@/lib/routing-server";
import { bestimmeFreigabeArten, ladeEintraege } from "@/lib/freigabe-server";
import PlanungBoard from "./_components/PlanungBoard";
import ZuteilungWerkbank from "./_components/ZuteilungWerkbank";

export const dynamic = "force-dynamic";

export default async function PlanungPage() {
  const admin = await createAdminClient();
  const runde = await ladeOffeneRunde(admin);

  // Der Antwortstand gehört auf den ersten Blick, nicht hinter den
  // Rechnen-Knopf. Vorher sah der Admin nach dem Start einer Runde nur die
  // Karte mit Frist und Knöpfen — ob überhaupt jemand geantwortet hat und
  // was gewählt wurde, blieb unsichtbar, bis er die Zuteilung rechnete.
  // Das las sich, als käme nichts an.
  const stand = runde ? await ladeAntwortStand(admin, runde.id) : [];

  // Die Werkbank: was aus dem Routenplaner übernommen wurde, samt dem, was
  // beim Freigeben je Person passieren würde.
  const eintraege = runde ? await ladeEintraege(admin, runde.id) : [];
  const [arten, fenster] = runde
    ? await Promise.all([
        bestimmeFreigabeArten(
          admin,
          runde.id,
          runde.art,
          eintraege.map((z) => z.schuelerId)
        ),
        ladeFenster(admin),
      ])
    : [{}, []];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">Terminplanung</h1>
        <p className="text-sm text-gray-500 mt-1">
          Verfügbarkeiten einsammeln, im Routenplaner rechnen, hier anpassen
          und pro Schüler freigeben.
        </p>
      </div>

      {runde && (
        <ZuteilungWerkbank
          eintraege={eintraege}
          arten={arten}
          fenster={fenster.map((f) => ({
            wochentag: f.wochentag,
            beginn: f.beginn,
            ende: f.ende,
          }))}
        />
      )}

      <PlanungBoard
        offeneRunde={
          runde
            ? {
                id: runde.id,
                titel: runde.titel,
                frist: runde.frist,
                art: runde.art,
                startDatum: runde.startDatum,
              }
            : null
        }
        antwortStand={stand.map((s) => ({
          studentId: s.studentId,
          name: s.name,
          geantwortet: s.geantwortet,
          aboVariante: s.aboVariante,
          aboRhythmus: s.aboRhythmus,
          fenster: s.fenster,
        }))
        }
      />
    </div>
  );
}
