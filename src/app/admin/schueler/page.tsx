import { createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { computePackageState, paketBezeichnung, type Package } from "@/lib/packages";
import {
  ZeitfensterListe,
  type AngegebenesFenster,
} from "@/components/ui/zeitfenster-liste";

export default async function AdminSchuelerPage() {
  const admin = await createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, vorname, nachname, email, aktiv, erstellt_am, extern, plattform")
    .eq("role", "student")
    .order("erstellt_am", { ascending: false });

  // Load active packages for all students in one query
  const studentIds = (profiles ?? []).map((p) => p.id);
  const { data: activePackages } = studentIds.length
    ? await admin
        .from("packages")
        .select("id, student_id, type, name, lessons_total, lessons_used, status, paused, expires_at, starts_at, total_price, price_per_lesson, payment_method")
        .in("student_id", studentIds)
        .eq("status", "active")
    : { data: [] };

  const packageByStudent: Record<string, Package> = {};
  for (const pkg of activePackages ?? []) {
    if (!packageByStudent[pkg.student_id]) {
      packageByStudent[pkg.student_id] = pkg as Package;
    }
  }

  // Angegebene Zeiten für die Übersicht. Sie beantworten die Frage, die man
  // beim Planen tatsächlich hat — „wer kann montags?" —, und zwar ohne jeden
  // Schüler einzeln aufzuklappen.
  const { data: zeitRows } = studentIds.length
    ? await admin
        .from("student_verfuegbarkeit")
        .select("student_id, wochentag, fruehestens, spaetestens, praeferenz, runde_id, erstellt_am")
        .in("student_id", studentIds)
        .order("erstellt_am", { ascending: false })
    : { data: [] };

  type ZeitRow = {
    student_id: string;
    wochentag: number;
    fruehestens: string | null;
    spaetestens: string | null;
    praeferenz: number | null;
    runde_id: string | null;
  };

  const alsFenster = (r: ZeitRow): AngegebenesFenster => ({
    wochentag: Number(r.wochentag),
    von: String(r.fruehestens ?? "16:30").slice(0, 5),
    bis: String(r.spaetestens ?? "20:30").slice(0, 5),
    praeferenz: Number(r.praeferenz ?? 2),
  });

  // Nur der jeweils aktuellste Stand pro Schüler: die Dauerangabe, sonst die
  // Zeiten der zuletzt beantworteten Runde. Alle Angaben nebeneinander wären
  // in einer Tabellenzelle nicht lesbar und widersprächen sich womöglich.
  //
  // Zwei Durchgänge, weil die Dauerangabe immer gewinnt, in der nach Datum
  // sortierten Liste aber irgendwo stehen kann.
  const dauerVon: Record<string, AngegebenesFenster[]> = {};
  const rundeVon: Record<string, { runde: string; fenster: AngegebenesFenster[] }> = {};
  for (const r of (zeitRows ?? []) as unknown as ZeitRow[]) {
    if (r.runde_id === null) {
      (dauerVon[r.student_id] ??= []).push(alsFenster(r));
      continue;
    }
    // Sortierung ist erstellt_am absteigend, die erste Runde je Schüler ist
    // also die neueste. Weitere Zeilen nur noch aus genau dieser Runde.
    const bisher = rundeVon[r.student_id];
    if (!bisher) {
      rundeVon[r.student_id] = { runde: r.runde_id, fenster: [alsFenster(r)] };
    } else if (bisher.runde === r.runde_id) {
      bisher.fenster.push(alsFenster(r));
    }
  }

  const zeitenVon: Record<string, AngegebenesFenster[]> = {};
  for (const id of studentIds) {
    zeitenVon[id] = dauerVon[id] ?? rundeVon[id]?.fenster ?? [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-800 text-[#1C244B]">Schüler</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/schueler/neu-extern"
            className="flex items-center gap-2 border border-gray-200 text-gray-600 text-sm font-600 px-4 py-2.5 rounded-xl hover:text-gray-900 hover:bg-gray-50 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Extern
          </Link>
          <Link
            href="/admin/schueler/neu"
            className="flex items-center gap-2 bg-[#1C244B] text-white text-sm font-600 px-4 py-2.5 rounded-xl hover:bg-[#151c3d] hover:-translate-y-0.5 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Neuer Schüler
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        {!profiles || profiles.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Noch keine Schüler erfasst</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide px-5 py-3">
                    Name
                  </th>
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide px-5 py-3 hidden sm:table-cell">
                    E-Mail
                  </th>
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide px-5 py-3 hidden md:table-cell">
                    Paket
                  </th>
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide px-5 py-3 hidden md:table-cell">
                    Verbleibend
                  </th>
                  {/* Statt des Anmeldedatums: Beim Planen will man wissen,
                      wer wann kann. Das Datum steht weiterhin in den
                      Details. */}
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide px-5 py-3 hidden lg:table-cell">
                    Kann
                  </th>
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide px-5 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profiles.map((s) => {
                  const pkg = packageByStudent[s.id] ?? null;
                  const state = pkg ? computePackageState(pkg) : null;

                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        {/* Ohne prefetch={false} rendert Next beim blossen
                            Anzeigen der Liste bis zu acht Detailseiten im
                            Hintergrund vor — jede mit eigenen Abfragen. */}
                        <Link
                          prefetch={false}
                          href={`/admin/schueler/${s.id}`}
                          className="font-600 text-gray-900 hover:text-[#1C244B] transition-colors text-sm"
                        >
                          {s.vorname} {s.nachname}
                        </Link>
                        {/* Externe erkennbar machen: Bei ihnen bleiben Paket,
                            Rechnung und E-Mail leer, und ohne Hinweis sähe
                            das nach einem unvollständigen Eintrag aus. */}
                        {s.extern && (
                          <span className="ml-2 text-xs font-600 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            {s.plattform || "extern"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 hidden sm:table-cell">
                        {s.email ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 hidden md:table-cell">
                        {s.extern ? (
                          <span className="text-gray-400">läuft extern</span>
                        ) : pkg ? (
                          paketBezeichnung(pkg)
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 hidden md:table-cell">
                        {state ? (
                          <span className="font-600 text-[#1C244B]">
                            {state.lessonsRemaining} Lekt.
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        {(zeitenVon[s.id] ?? []).length > 0 ? (
                          <ZeitfensterListe fenster={zeitenVon[s.id]} klein />
                        ) : (
                          <span className="text-sm text-gray-400">
                            keine Angabe
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`text-xs font-500 px-2.5 py-0.5 rounded-full ${
                            s.aktiv
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {s.aktiv ? "Aktiv" : "Inaktiv"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
