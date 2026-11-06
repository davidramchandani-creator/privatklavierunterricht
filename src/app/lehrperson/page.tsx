import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Logo from "@/components/layout/Logo";
import { logout } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

/**
 * Lehrpersonen-Portal (Platzhalter bis Schritt 1e).
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

  const { data: ich } = await supabase
    .from("teachers")
    .select("vorname")
    .eq("profile_id", user.id)
    .maybeSingle();

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
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-[#EAECEF] shadow-sm p-8 space-y-3 animate-enter-up">
          <h1 className="text-2xl font-800 text-navy-900">
            Hallo{ich?.vorname ? ` ${ich.vorname}` : ""}
          </h1>
          <p className="text-gray-500 leading-relaxed">
            Dein Portal wird gerade eingerichtet. Hier siehst du bald die Anfragen von David, deine
            Termine und deine Schüler.
          </p>
        </div>
      </main>
    </div>
  );
}
