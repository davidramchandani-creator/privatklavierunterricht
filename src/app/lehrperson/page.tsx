import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/layout/Logo";
import EinfacherText from "@/components/EinfacherText";
import { logout } from "@/app/auth/actions";
import LeitbildBestaetigen from "./LeitbildBestaetigen";

export const dynamic = "force-dynamic";

/**
 * Lehrpersonen-Portal. Anfragen, Termine und Schüler folgen in Schritt 1e.
 *
 * **Grundsatz für alles unter /lehrperson:** Nur der Client mit der Sitzung
 * der Lehrperson (`createClient`), nie der Service-Schlüssel
 * (`createAdminClient`). So entscheidet RLS, was sie sieht, und nicht ein
 * vergessenes `if` im Code. Ein Test (lehrpersonen-fundament.test.ts)
 * prüft das.
 */
export default async function LehrpersonPortal() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: ich }, { data: leitbild }] = await Promise.all([
    supabase.from("teachers").select("id, vorname").eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("leitbild_versionen")
      .select("id, version, titel, inhalt, veroeffentlicht_am")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const { data: bestaetigung } =
    leitbild && ich
      ? await supabase
          .from("leitbild_bestaetigungen")
          .select("bestaetigt_am")
          .eq("version_id", leitbild.id)
          .eq("teacher_id", ich.id)
          .maybeSingle()
      : { data: null };

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-white border-b border-[#EAECEF]">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Logo className="h-6 w-auto" />
          <form action={logout}>
            <button type="submit" className="text-sm text-gray-500 hover:text-navy-900">
              Abmelden
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <div className="bg-white rounded-2xl border border-[#EAECEF] shadow-sm p-8 space-y-3 animate-enter-up">
          <h1 className="text-2xl font-800 text-navy-900">Hallo{ich?.vorname ? ` ${ich.vorname}` : ""}</h1>
          <p className="text-gray-500 leading-relaxed">
            Hier siehst du bald die Anfragen von David, deine Termine und deine Schüler.
          </p>
        </div>

        {leitbild && (
          <div
            className={`bg-white rounded-2xl border shadow-sm p-8 space-y-4 ${
              bestaetigung ? "border-[#EAECEF]" : "border-amber-300"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-600 text-gray-400 uppercase tracking-wide">
                  Version {leitbild.version} vom{" "}
                  {new Date(leitbild.veroeffentlicht_am).toLocaleDateString("de-CH", { timeZone: "Europe/Zurich" })}
                </p>
                <h2 className="text-xl font-800 text-navy-900">{leitbild.titel}</h2>
              </div>
              {bestaetigung ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-600 text-emerald-700 bg-emerald-50 rounded-full px-3 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Bestätigt
                </span>
              ) : (
                <span className="text-xs font-600 text-amber-700 bg-amber-100 rounded-full px-3 py-1">Bitte bestätigen</span>
              )}
            </div>
            <div className="text-sm text-gray-700">
              <EinfacherText text={leitbild.inhalt} />
            </div>
            {!bestaetigung && <LeitbildBestaetigen versionId={leitbild.id} />}
          </div>
        )}
      </main>
    </div>
  );
}
