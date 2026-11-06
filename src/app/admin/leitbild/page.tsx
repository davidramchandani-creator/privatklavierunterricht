import { CheckCircle2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import EinfacherText from "@/components/EinfacherText";
import LeitbildEditor from "./LeitbildEditor";

export const dynamic = "force-dynamic";

function datum(iso: string) {
  return new Date(iso).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich", day: "numeric", month: "long", year: "numeric" });
}

/**
 * Leitbild: David pflegt es, jede neue Version müssen alle aktiven
 * Lehrpersonen (ausser David) im Portal bestätigen.
 */
export default async function LeitbildPage() {
  const supabase = await createClient();
  const [{ data: versionen }, { data: lehrpersonen }, { data: bestaetigungen }] = await Promise.all([
    supabase.from("leitbild_versionen").select("id, version, titel, inhalt, veroeffentlicht_am").order("version", { ascending: false }),
    supabase.from("teachers").select("id, vorname, nachname").eq("status", "aktiv").eq("ist_inhaber", false).order("vorname"),
    supabase.from("leitbild_bestaetigungen").select("version_id, teacher_id, bestaetigt_am"),
  ]);
  const aktuell = versionen?.[0] ?? null;
  const bestaetigt = new Map(
    (bestaetigungen ?? []).filter((b) => b.version_id === aktuell?.id).map((b) => [b.teacher_id, b.bestaetigt_am])
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">Leitbild</h1>
        <p className="text-sm text-gray-500 mt-1">
          Jede neue Version müssen alle Lehrpersonen im Portal bestätigen. Hier siehst du, wer welche Version bestätigt hat.
        </p>
      </div>

      {aktuell && (
        <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-2">
            <p className="text-xs font-600 text-gray-400 uppercase tracking-wide">
              Aktuell: Version {aktuell.version} vom {datum(aktuell.veroeffentlicht_am)}
            </p>
            <h2 className="text-xl font-800 text-[#1C244B]">{aktuell.titel}</h2>
            <div className="text-sm text-gray-700">
              <EinfacherText text={aktuell.inhalt} />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <p className="text-sm font-700 text-[#1C244B]">Bestätigt (Version {aktuell.version})</p>
            {(lehrpersonen ?? []).length === 0 ? (
              <p className="text-xs text-gray-500">Noch keine weiteren Lehrpersonen.</p>
            ) : (
              <ul className="space-y-2">
                {(lehrpersonen ?? []).map((l) => {
                  const am = bestaetigt.get(l.id);
                  return (
                    <li key={l.id} className="flex items-center gap-2 text-sm">
                      {am ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500" />
                      )}
                      <span className="text-gray-800">
                        {l.vorname} {l.nachname}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">{am ? datum(am) : "offen"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <LeitbildEditor titel={aktuell?.titel ?? "Leitbild"} inhalt={aktuell?.inhalt ?? ""} neueVersion={(aktuell?.version ?? 0) + 1} />

      {(versionen ?? []).length > 1 && (
        <details className="bg-white rounded-2xl border border-gray-200 p-5">
          <summary className="text-sm font-600 text-gray-600 cursor-pointer">Frühere Versionen</summary>
          <div className="space-y-6 mt-4">
            {(versionen ?? []).slice(1).map((v) => (
              <div key={v.id} className="space-y-1">
                <p className="text-xs font-600 text-gray-400">
                  Version {v.version} vom {datum(v.veroeffentlicht_am)}
                </p>
                <div className="text-sm text-gray-600">
                  <EinfacherText text={v.inhalt} />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
