import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { redirectAddress } from "@/lib/email-sender";

/**
 * Warnstreifen, solange der Testmodus läuft.
 *
 * Der Zweck ist nicht Information, sondern Ärgernis: ein Testmodus, den man
 * still anlassen kann, ist gefährlicher als gar keiner. Wenn EMAIL_REDIRECT_TO
 * nach dem Testen stehen bleibt, bekommt kein Schüler je wieder eine Mail —
 * und niemand merkt es, weil nichts kaputtgeht. Darum steht der Streifen auf
 * jeder Admin-Seite, nicht nur auf der Testseite.
 */
export default async function TestmodusBanner() {
  const umleitung = redirectAddress();

  const admin = await createAdminClient();
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("ist_test", true);

  const testSchueler = count ?? 0;
  if (!umleitung && testSchueler === 0) return null;

  return (
    <div className="bg-amber-400 text-[#1c1917]">
      <div className="px-4 md:px-6 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-snug">
        <span className="inline-flex items-center gap-1.5 font-700">
          <FlaskConical className="w-3.5 h-3.5" />
          Testmodus
        </span>

        {umleitung && (
          <span>
            Alle Mails gehen an <strong>{umleitung}</strong>, kein Schüler
            bekommt Post.
          </span>
        )}
        {!umleitung && testSchueler > 0 && (
          <span className="font-600">
            Achtung: Mail-Umleitung ist aus, aber es gibt noch {testSchueler}{" "}
            Testschüler.
          </span>
        )}
        {umleitung && testSchueler > 0 && (
          <span>{testSchueler} Testschüler angelegt.</span>
        )}

        <Link
          href="/admin/testmodus"
          className="underline font-600 ml-auto whitespace-nowrap"
        >
          Beenden
        </Link>
      </div>
    </div>
  );
}
