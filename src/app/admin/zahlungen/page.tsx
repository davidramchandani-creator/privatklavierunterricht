import { createClient } from "@/lib/supabase/server";
import { CreditCard } from "lucide-react";
import { formatCHF, formatDate } from "@/lib/utils";
import ZahlungFilterClient from "./_components/ZahlungFilterClient";

export default async function ZahlungenPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "alle" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("zahlungen")
    .select("*, schueler(vorname, nachname)")
    .order("faellig_am", { ascending: true });

  if (filter === "offen") {
    query = query.eq("status", "offen");
  } else if (filter === "bezahlt") {
    query = query.eq("status", "bezahlt");
  }

  const { data: zahlungen } = await query;

  const statusColors: Record<string, string> = {
    offen: "bg-amber-50 text-amber-700",
    bezahlt: "bg-emerald-50 text-emerald-700",
    ausstehend: "bg-gray-100 text-gray-600",
  };

  const statusLabels: Record<string, string> = {
    offen: "Offen",
    bezahlt: "Bezahlt",
    ausstehend: "Ausstehend",
  };

  const total = zahlungen?.reduce((sum, z) => sum + (z.betrag ?? 0), 0) ?? 0;
  const totalOffen =
    zahlungen
      ?.filter((z) => z.status === "offen")
      .reduce((sum, z) => sum + (z.betrag ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-800 text-[#3730A3]">Zahlungen</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-600 uppercase tracking-wide mb-1">
            Gesamt
          </p>
          <p className="text-xl font-800 text-gray-900">{formatCHF(total)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-600 uppercase tracking-wide mb-1">
            Offen
          </p>
          <p className="text-xl font-800 text-amber-600">{formatCHF(totalOffen)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {["alle", "offen", "bezahlt"].map((f) => (
            <a
              key={f}
              href={`/admin/zahlungen?filter=${f}`}
              className={`text-sm font-600 px-3.5 py-1.5 rounded-lg transition-colors capitalize ${
                filter === f
                  ? "bg-[#3730A3] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {f === "alle" ? "Alle" : f === "offen" ? "Offen" : "Bezahlt"}
            </a>
          ))}
        </div>

        {!zahlungen || zahlungen.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Keine Zahlungen gefunden</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 pr-4">
                    Schüler
                  </th>
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 pr-4">
                    Betrag
                  </th>
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 pr-4 hidden sm:table-cell">
                    Fällig am
                  </th>
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 pr-4 hidden md:table-cell">
                    Methode
                  </th>
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 pr-4 hidden lg:table-cell">
                    Rechnung Nr.
                  </th>
                  <th className="text-left text-xs font-600 text-gray-400 uppercase tracking-wide pb-2 pr-4">
                    Status
                  </th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {zahlungen.map((z) => {
                  const s = z.schueler as
                    | { vorname: string; nachname: string }
                    | null;
                  return (
                    <tr key={z.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4 text-sm font-500 text-gray-900">
                        {s ? `${s.vorname} ${s.nachname}` : "—"}
                      </td>
                      <td className="py-3 pr-4 text-sm font-600 text-gray-900">
                        {formatCHF(z.betrag)}
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-600 hidden sm:table-cell">
                        {z.faellig_am ? formatDate(z.faellig_am) : "—"}
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-600 hidden md:table-cell capitalize">
                        {z.methode ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-sm text-gray-500 hidden lg:table-cell">
                        {z.rechnung_nr ?? "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`text-xs font-500 px-2.5 py-0.5 rounded-full ${
                            statusColors[z.status] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {statusLabels[z.status] ?? z.status}
                        </span>
                      </td>
                      <td className="py-3">
                        {z.status === "offen" && (
                          <ZahlungFilterClient zahlungId={z.id} />
                        )}
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
