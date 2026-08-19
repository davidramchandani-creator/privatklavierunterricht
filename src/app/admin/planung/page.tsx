import { createAdminClient } from "@/lib/supabase/server";
import { ladeOffeneRunde } from "@/lib/planung-server";
import PlanungBoard from "./_components/PlanungBoard";

export const dynamic = "force-dynamic";

export default async function PlanungPage() {
  const admin = await createAdminClient();
  const runde = await ladeOffeneRunde(admin);

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
      />
    </div>
  );
}
