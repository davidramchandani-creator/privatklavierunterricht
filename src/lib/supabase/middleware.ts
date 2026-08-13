import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { gehoertZu } from "@/lib/pfad";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              // Gesetzte Session-Cookies mind. 30 Tage halten → dauerhaft
              // eingeloggt. Leerer value = Löschung (maxAge 0/negativ) → NICHT
              // verlängern, sonst bleiben veraltete Auth-Chunks liegen.
              value
                ? { ...options, maxAge: Math.max(options?.maxAge ?? 0, 60 * 60 * 24 * 30) }
                : options
            )
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Rolle aus `profiles` – einzige Wahrheitsquelle. Nur laden, wenn relevant.
  let role: string | null = null;
  if (
    user &&
    (gehoertZu(pathname, "/admin") ||
      gehoertZu(pathname, "/schueler") ||
      gehoertZu(pathname, "/auth/login") ||
      gehoertZu(pathname, "/auth/register"))
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
  }

  // Admin-Bereich: nur Admins
  if (gehoertZu(pathname, "/admin")) {
    if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));
    if (role !== "admin")
      return NextResponse.redirect(new URL("/", request.url));
  }

  // Schülerportal: nur eingeloggte Schüler – Admins gehören ins Admin-Panel
  if (gehoertZu(pathname, "/schueler")) {
    if (!user)
      return NextResponse.redirect(new URL("/auth/login", request.url));
    if (role === "admin")
      return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Bereits eingeloggt? Login/Register überspringen und passend weiterleiten.
  if (
    (gehoertZu(pathname, "/auth/login") ||
      gehoertZu(pathname, "/auth/register")) &&
    user
  ) {
    return NextResponse.redirect(
      new URL(role === "admin" ? "/admin" : "/schueler/portal", request.url)
    );
  }

  return supabaseResponse;
}
