import { createClient } from "@/lib/supabase/server";
import { Star } from "lucide-react";
import { formatDate } from "@/lib/utils";
import BewertungActions from "./_components/BewertungActions";

export default async function BewertungenPage() {
  const supabase = await createClient();

  const { data: bewertungen } = await supabase
    .from("bewertungen")
    .select("*, schueler(vorname, nachname)")
    .order("erstellt_am", { ascending: false });

  const pending = bewertungen?.filter((b) => !b.anzeigen) ?? [];
  const approved = bewertungen?.filter((b) => b.anzeigen) ?? [];

  function StarRow({ sterne }: { sterne: number }) {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${
              i < sterne ? "fill-[#C9A84C] text-[#C9A84C]" : "text-gray-200"
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-800 text-[#1C244B]">Bewertungen</h1>

      {/* Pending */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">
          Ausstehend ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Star className="w-7 h-7 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Keine ausstehenden Bewertungen</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((b) => {
              const s = b.schueler as
                | { vorname: string; nachname: string }
                | null;
              return (
                <div
                  key={b.id}
                  className="border border-amber-200 bg-amber-50/50 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-600 text-gray-900">
                        {s ? `${s.vorname} ${s.nachname}` : "Unbekannt"}
                      </p>
                      <StarRow sterne={b.sterne} />
                    </div>
                    <p className="text-xs text-gray-400">
                      {b.erstellt_am ? formatDate(b.erstellt_am) : ""}
                    </p>
                  </div>
                  {b.text && (
                    <p className="text-sm text-gray-700 italic">„{b.text}"</p>
                  )}
                  <BewertungActions id={b.id} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Approved */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-700 text-[#1C244B] mb-4">
          Veröffentlicht ({approved.length})
        </h2>

        {approved.length === 0 ? (
          <p className="text-sm text-gray-400">Noch keine veröffentlichten Bewertungen.</p>
        ) : (
          <div className="space-y-3">
            {approved.map((b) => {
              const s = b.schueler as
                | { vorname: string; nachname: string }
                | null;
              return (
                <div
                  key={b.id}
                  className="border border-gray-200 rounded-xl p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-600 text-gray-900">
                        {s ? `${s.vorname} ${s.nachname}` : "Unbekannt"}
                      </p>
                      <StarRow sterne={b.sterne} />
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs text-gray-400">
                        {b.erstellt_am ? formatDate(b.erstellt_am) : ""}
                      </p>
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-500">
                        Veröffentlicht
                      </span>
                    </div>
                  </div>
                  {b.text && (
                    <p className="text-sm text-gray-700 italic">„{b.text}"</p>
                  )}
                  <BewertungActions id={b.id} approved />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
