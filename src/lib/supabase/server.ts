import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Verlängert die Lebensdauer von Session-Cookies auf mind. 30 Tage, damit
 * Nutzer dauerhaft eingeloggt bleiben. WICHTIG: Nur auf gesetzte Cookies
 * anwenden, bei leerem `value` will Supabase das Cookie löschen
 * (maxAge 0/negativ); diese Löschung darf NICHT verlängert werden, sonst
 * bleiben veraltete Auth-Cookie-Chunks liegen und zerstören u. a. den
 * Passwort-Reset-Flow.
 */
type CookieOptions = Parameters<
  Awaited<ReturnType<typeof cookies>>["set"]
>[2];

function withPersistence(value: string, options: CookieOptions): CookieOptions {
  if (!value) return options;
  return { ...options, maxAge: Math.max(options?.maxAge ?? 0, 60 * 60 * 24 * 30) };
}

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
              cookieStore.set(name, value, withPersistence(value, options))
            );
          } catch {
            // Called from Server Component, middleware handles session refresh
          }
        },
      },
    }
  );
}

/**
 * Echter Service-Role-Client (umgeht RLS). WICHTIG: Hier darf KEIN
 * Cookie-/Session-Client (`createServerClient`) verwendet werden, dieser würde
 * die User-Session aus dem Cookie übernehmen und damit als der eingeloggte
 * Nutzer statt als service_role agieren. Stattdessen ein sessionsloser
 * supabase-js-Client mit dem Service-Role-Key.
 *
 * Nur serverseitig verwenden, der Key darf NIEMALS in den Browser gelangen.
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
