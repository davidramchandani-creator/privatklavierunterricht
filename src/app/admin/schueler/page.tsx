import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function AdminSchuelerPage() {
  const supabase = await createClient();

  const { data: schueler } = await supabase
    .from("schueler")
    .select(`
      id, vorname, nachname, email, aktiv, erstellt_am,
      pakete(id, typ, lektionen_gesamt, lektionen_genutzt, aktiv)
    `)
    .order("erstellt_am", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-800 text-[#1C244B]">Schüler</h1>
        <Link
          href="/admin/schueler/neu"
          className="flex items-center gap-2 bg-[#1C244B] text-white text-sm font-600 px-4 py-2.5 rounded-xl hover:bg-[#151c3d] hover:-translate-y-0.5 transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Neuer Schüler
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        {!schueler || schueler.length === 0 ? (
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
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide px-5 py-3 hidden lg:table-cell">
                    Seit
                  </th>
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide px-5 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schueler.map((s) => {
                  const paketeArr = Array.isArray(s.pakete) ? s.pakete : [];
                  const aktivPaket = paketeArr.find((p) => p.aktiv);
                  const verbleibend = aktivPaket
                    ? aktivPaket.lektionen_gesamt - aktivPaket.lektionen_genutzt
                    : null;

                  const typLabels: Record<string, string> = {
                    einzellektion: "Einzellektion",
                    "10er": "10er-Paket",
                    "20er": "20er-Paket",
                  };

                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/admin/schueler/${s.id}`}
                          className="font-600 text-gray-900 hover:text-[#1C244B] transition-colors text-sm"
                        >
                          {s.vorname} {s.nachname}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 hidden sm:table-cell">
                        {s.email}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 hidden md:table-cell">
                        {aktivPaket
                          ? typLabels[aktivPaket.typ] ?? aktivPaket.typ
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600 hidden md:table-cell">
                        {verbleibend !== null ? (
                          <span className="font-600 text-[#1C244B]">
                            {verbleibend} Lekt.
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 hidden lg:table-cell">
                        {s.erstellt_am ? formatDate(s.erstellt_am) : "—"}
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
