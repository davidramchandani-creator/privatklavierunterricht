import Link from "next/link";
import { FlaskConical, MailWarning } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { redirectAddress } from "@/lib/email-sender";

/**
 * Warnstreifen für Zustände, die man nicht übersehen darf.
 *
 * Zwei Dinge stehen hier, weil sie beide dieselbe Eigenschaft haben: Es geht
 * etwas schief, ohne dass irgendwo etwas kaputt aussieht.
 *
 *   • Der Testmodus. Bleibt EMAIL_REDIRECT_TO nach dem Testen stehen, bekommt
 *     kein Schüler je wieder Post — und niemand merkt es.
 *   • Endgültig gescheiterte Mails. Eine Terminbestätigung, die nie ankam,
 *     fällt niemandem auf: der Schüler wartet, der Admin denkt, sie sei
 *     draussen. Genau das ist im Bestand fünfmal passiert.
 *
 * Darum auf jeder Admin-Seite, nicht auf einer Unterseite, die man aufsuchen
 * müsste.
 */
export default async function SystemBanner() {
  const umleitung = redirectAddress();
  const admin = await createAdminClient();

  const [{ count: testCount }, { count: mailCount }] = await Promise.all([
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("ist_test", true),
    // Nur die endgültig aufgegebenen: was noch wiederholt wird, ist kein
    // Problem, sondern der normale Lauf.
    admin
      .from("scheduled_emails")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("versuche", 3),
  ]);

  const testSchueler = testCount ?? 0;
  const gescheiterteMails = mailCount ?? 0;

  if (!umleitung && testSchueler === 0 && gescheiterteMails === 0) return null;

  return (
    <div className="bg-amber-400 text-[#1c1917] divide-y divide-amber-500/30">
      {(umleitung || testSchueler > 0) && (
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
      )}

      {gescheiterteMails > 0 && (
        <div className="px-4 md:px-6 py-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-snug">
          <span className="inline-flex items-center gap-1.5 font-700">
            <MailWarning className="w-3.5 h-3.5" />
            {gescheiterteMails} Mail{gescheiterteMails === 1 ? "" : "s"} nicht
            zugestellt
          </span>
          <span>
            Nach drei Versuchen aufgegeben — die Empfänger haben nichts
            bekommen.
          </span>
          <Link
            href="/admin/einstellungen"
            className="underline font-600 ml-auto whitespace-nowrap"
          >
            Ansehen
          </Link>
        </div>
      )}
    </div>
  );
}
