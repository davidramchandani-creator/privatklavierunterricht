import { createAdminClient } from "@/lib/supabase/server";
import { todayInZurich } from "@/lib/subscription";
import FerienVerwaltung, {
  type Ferienzeile,
} from "./_components/FerienVerwaltung";

export const dynamic = "force-dynamic";

export default async function SchulferienPage() {
  const admin = await createAdminClient();
  const heute = todayInZurich();

  const { data } = await admin
    .from("schulferien")
    .select("id, bezeichnung, start_datum, end_datum")
    .order("start_datum", { ascending: false });

  const zeilen: Ferienzeile[] = (data ?? []).map((f) => {
    const start = String(f.start_datum);
    const ende = String(f.end_datum);
    return {
      id: f.id as string,
      bezeichnung: f.bezeichnung as string,
      start,
      ende,
      tage:
        Math.round(
          (Date.parse(`${ende}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
            86400000
        ) + 1,
      vergangen: ende < heute,
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">Schulferien</h1>
        <p className="text-sm text-gray-500 mt-1">
          Unterrichtsfreie Zeiten — Grundlage für die Lektionszahl eines Abos.
        </p>
      </div>

      <FerienVerwaltung
        zeilen={zeilen.sort((a, b) => a.start.localeCompare(b.start))}
      />
    </div>
  );
}
