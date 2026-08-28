import { createAdminClient } from "@/lib/supabase/server";
import { ladeOffeneNotizen } from "@/lib/lektionsnotizen-server";
import { OFFEN_MAX_TAGE } from "@/lib/lektionsnotizen";
import { NotebookPen } from "lucide-react";
import OffeneListe from "./_components/OffeneListe";

export const dynamic = "force-dynamic";

export default async function LektionenNotierenPage() {
  const admin = await createAdminClient();
  const offen = await ladeOffeneNotizen(admin);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-800 text-[#1C244B]">Was lief?</h1>
        <p className="text-sm text-gray-500 mt-1">
          Lektionen der letzten {OFFEN_MAX_TAGE} Tage ohne Eintrag. Nur für
          dich sichtbar.
        </p>
      </div>

      {offen.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm text-center py-14 text-gray-400">
          <NotebookPen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Alles eingetragen.</p>
        </div>
      ) : (
        <OffeneListe offen={offen} />
      )}
    </div>
  );
}
