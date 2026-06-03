import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component – middleware handles session refresh
          }
        },
      },
    }
  );
}

/**
 * Echter Service-Role-Client (umgeht RLS). WICHTIG: Hier darf KEIN
 * Cookie-/Session-Client (`createServerClient`) verwendet werden – dieser würde
 * die User-Session aus dem Cookie übernehmen und damit als der eingeloggte
 * Nutzer statt als service_role agieren. Stattdessen ein sessionsloser
 * supabase-js-Client mit dem Service-Role-Key.
 *
 * Nur serverseitig verwenden – der Key darf NIEMALS in den Browser gelangen.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
