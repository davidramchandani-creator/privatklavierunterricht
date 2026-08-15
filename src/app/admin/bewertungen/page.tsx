import { createAdminClient } from "@/lib/supabase/server";
import BewertungsListe, { type AdminBewertung } from "./_components/BewertungsListe";
import BewertungEintragen from "./_components/BewertungEintragen";

export const dynamic = "force-dynamic";

export default async function AdminBewertungenPage() {
  const admin = await createAdminClient();

  const { data } = await admin
    .from("reviews")
    .select("id, name, sterne, text, text_kurz, status, quelle, created_at")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  const bewertungen: AdminBewertung[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    sterne: r.sterne,
    text: r.text,
    textKurz: r.text_kurz,
    status: r.status as AdminBewertung["status"],
    quelle: r.quelle,
    datum: new Date(r.created_at).toLocaleDateString("de-CH", {
      timeZone: "Europe/Zurich",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">Bewertungen</h1>
        <p className="text-sm text-gray-500 mt-1">
          Neue Bewertungen stehen erst auf der Website, wenn du sie freigibst.
        </p>
      </div>
      <BewertungEintragen />
      <BewertungsListe bewertungen={bewertungen} />
    </div>
  );
}
