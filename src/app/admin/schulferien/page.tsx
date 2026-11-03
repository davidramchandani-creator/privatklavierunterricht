import { createAdminClient } from "@/lib/supabase/server";
import { todayInZurich } from "@/lib/subscription";
import FerienVerwaltung, {
  type Ferienzeile,
} from "./_components/FerienVerwaltung";
import SemesterVerwaltung from "./_components/SemesterVerwaltung";

export const dynamic = "force-dynamic";

export default async function SchulferienPage() {
  const admin = await createAdminClient();
  const heute = todayInZurich();

  const [{ data }, { data: semester }] = await Promise.all([
    admin
      .from("schulferien")
      .select("id, bezeichnung, start_datum, end_datum")
      .order("start_datum", { ascending: false }),
    admin.from("semester").select("id, bezeichnung, beginn, ende").order("beginn"),
  ]);

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
        <h1 className="text-2xl font-800 text-[#1C244B]">Semester &amp; Ferien</h1>
        <p className="text-sm text-gray-500 mt-1">
          Abos laufen bis Semesterende. In den unterrichtsfreien Zeiten (deine
          Ferien und Praktika) entstehen keine Termine. Selbstlernzeit und
          Studienwochen sind normale Unterrichtswochen.
        </p>
      </div>

      <a
        href="/admin/schulferien/umstellung"
        className="block rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 hover:bg-amber-100 transition-colors"
      >
        <span className="font-700">Laufende Abos aufs Semester umstellen</span>
        <span className="block text-xs mt-0.5">
          Vorschau pro Schüler mit Lektionen, Raten, Terminen und Mail. Geändert
          wird erst auf deinen Klick.
        </span>
      </a>

      <SemesterVerwaltung
        semester={(semester ?? []).map((s) => ({
          id: s.id as string,
          bezeichnung: String(s.bezeichnung),
          beginn: String(s.beginn),
          ende: String(s.ende),
          vergangen: String(s.ende) < heute,
        }))}
      />

      <h2 className="text-lg font-700 text-[#1C244B] pt-2">Unterrichtsfreie Zeiten</h2>

      <FerienVerwaltung
        zeilen={zeilen.sort((a, b) => a.start.localeCompare(b.start))}
      />
    </div>
  );
}
