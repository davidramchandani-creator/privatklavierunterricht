import { createAdminClient } from "@/lib/supabase/server";
import { ladeSchueler, ladeZuhause } from "@/lib/routing-server";
import { standardKreis } from "@/lib/kreis";
import RoutenplanerBoard from "./_components/RoutenplanerBoard";

export const dynamic = "force-dynamic";

export default async function RoutenplanungPage() {
  const admin = await createAdminClient();

  // Läuft ein Testlauf, ist die Testsicht die Vorgabe. Sonst mischte sich
  // beides und die Fahrzeiten stimmten für keinen der beiden Fälle.
  const kreis = await standardKreis(admin);

  const [zuhause, schueler, echte, test] = await Promise.all([
    ladeZuhause(admin),
    ladeSchueler(admin, kreis),
    ladeSchueler(admin, "echt"),
    ladeSchueler(admin, "test"),
  ]);

  const ohneAdresse = schueler.filter((s) => s.lat == null || s.lng == null).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">Routenplanung</h1>
        <p className="text-sm text-gray-500 mt-1">
          Schüler so auf Tage und Uhrzeiten verteilen, dass möglichst wenig
          Fahrzeit anfällt.
        </p>
      </div>

      <RoutenplanerBoard
        zuhauseAdresse={zuhause.adresse}
        schuelerGesamt={schueler.length}
        ohneAdresse={ohneAdresse}
        kreisVorgabe={kreis}
        anzahlEcht={echte.length}
        anzahlTest={test.length}
      />
    </div>
  );
}
