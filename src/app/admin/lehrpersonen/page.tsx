import Link from "next/link";
import { Plus, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ORT_LABEL, istOeffentlich, type Unterrichtsort } from "@/lib/lehrpersonen";

export const dynamic = "force-dynamic";

export default async function LehrpersonenPage() {
  const supabase = await createClient();
  const [{ data: liste }, { data: schueler }] = await Promise.all([
    supabase
      .from("teachers")
      .select("id, vorname, nachname, foto_url, status, unterrichtsorte, region, ist_inhaber, kurztext, kurztext_entwurf, lohn_pro_lektion")
      .order("ist_inhaber", { ascending: false })
      .order("sortierung")
      .order("vorname"),
    supabase.from("profiles").select("teacher_id").eq("role", "student").eq("aktiv", true).eq("ist_test", false),
  ]);
  const anzahl = new Map<string, number>();
  for (const s of schueler ?? []) {
    if (s.teacher_id) anzahl.set(s.teacher_id, (anzahl.get(s.teacher_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-800 text-[#1C244B]">Lehrpersonen</h1>
          <p className="text-sm text-gray-500 mt-1">Nur du kannst Lehrpersonen anlegen, ändern und freigeben.</p>
        </div>
        <Link href="/admin/lehrpersonen/neu">
          <Button>
            <Plus className="w-4 h-4" /> Neue Lehrperson
          </Button>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {(liste ?? []).map((l) => (
          <Link
            key={l.id}
            href={`/admin/lehrpersonen/${l.id}`}
            className="bg-white rounded-2xl border border-gray-200 p-5 flex gap-4 transition-transform hover:-translate-y-0.5 hover:shadow-sm"
          >
            {l.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.foto_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-navy-50 flex items-center justify-center">
                <UserRound className="w-6 h-6 text-navy-900" />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-700 text-[#1C244B]">
                {l.vorname} {l.nachname}
                {l.ist_inhaber && <span className="ml-2 text-xs font-600 text-gray-400">du</span>}
              </p>
              <p className="text-xs text-gray-500">
                {(l.unterrichtsorte as Unterrichtsort[]).map((o) => ORT_LABEL[o]).join(", ") || "Kein Ort"} · {l.region} ·{" "}
                {anzahl.get(l.id) ?? 0} Schüler
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span
                  className={`text-xs font-600 px-2 py-0.5 rounded-full ${l.status === "aktiv" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                >
                  {l.status === "aktiv" ? "Aktiv" : "Inaktiv"}
                </span>
                {istOeffentlich(l) ? (
                  <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-navy-50 text-navy-900">Auf der Webseite</span>
                ) : (
                  <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Nicht öffentlich</span>
                )}
                {l.kurztext_entwurf && (
                  <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Text zur Freigabe</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
