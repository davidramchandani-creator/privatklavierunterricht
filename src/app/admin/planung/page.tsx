import { createAdminClient } from "@/lib/supabase/server";
import { ladeAntwortStand, ladeOffeneRunde } from "@/lib/planung-server";
import PlanungBoard from "./_components/PlanungBoard";

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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">Terminplanung</h1>
        <p className="text-sm text-gray-500 mt-1">
          Verfügbarkeiten einsammeln, dann alle auf einmal zuteilen.
        </p>
      </div>

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
          fensterAnzahl: s.fensterAnzahl,
        }))
        }
      />
    </div>
  );
}
