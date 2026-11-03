import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { planeUmstellung, umstellungsMailDaten } from "@/lib/semester-umstellung-server";
import { renderEmail } from "@/lib/email-templates";
import UmstellungBoard from "./_components/UmstellungBoard";

export const dynamic = "force-dynamic";

/**
 * Umstellung der laufenden Abos auf den Semesterrhythmus.
 *
 * Alles hier ist zuerst nur gerechnet. Geändert wird erst, wenn David pro
 * Schüler auf „Umstellen“ drückt, und die Mail geht nur mit Häkchen raus.
 */
export default async function UmstellungPage() {
  const admin = await createAdminClient();
  const { zeilen, externe } = await planeUmstellung(admin);

  const mitVorschau = zeilen.map((z) => {
    const mail = z.erledigt || z.hinderung ? null : renderEmail("semester_umstellung", umstellungsMailDaten(z));
    return { ...z, mailBetreff: mail?.subject ?? null, mailHtml: mail?.html ?? null };
  });

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/schulferien" className="text-xs text-gray-500 hover:text-gray-900 underline">
          Zurück zu Semester &amp; Ferien
        </Link>
        <h1 className="text-2xl font-800 text-[#1C244B] mt-1">Abos aufs Semester umstellen</h1>
        <p className="text-sm text-gray-500 mt-1">
          Für jedes laufende Abo siehst du, was sich ändert. Geändert wird erst
          mit „Umstellen“, die Mail geht nur mit Häkchen raus. Bezahlte Raten
          bleiben, der Rest verteilt sich auf die offenen Raten bis Semesterende.
        </p>
      </div>
      <UmstellungBoard zeilen={mitVorschau} externe={externe} />
    </div>
  );
}
