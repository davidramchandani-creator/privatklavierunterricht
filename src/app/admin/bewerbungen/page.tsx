import { createClient } from "@/lib/supabase/server";
import BewerbungenBoard, { type BewerbungZeile } from "./_components/BewerbungenBoard";

export const dynamic = "force-dynamic";

export default async function BewerbungenPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("bewerbungen").select("*").order("erstellt_am", { ascending: false });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">Bewerbungen</h1>
        <p className="text-sm text-gray-500 mt-1">
          Von der Seite „Lehrperson werden“. Stufe wechseln, vorbereitete Mail anpassen und senden, bei Zusage
          direkt als Lehrperson anlegen.
        </p>
      </div>
      <BewerbungenBoard liste={(data ?? []) as BewerbungZeile[]} />
    </div>
  );
}
