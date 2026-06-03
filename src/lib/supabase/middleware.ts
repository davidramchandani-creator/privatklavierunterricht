import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
            supabaseResponse.cookies.set(name, value, options)
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
    (pathname.startsWith("/admin") ||
      pathname.startsWith("/schueler") ||
      pathname.startsWith("/auth/login") ||
      pathname.startsWith("/auth/register"))
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
  }

  // Admin-Bereich: nur Admins
  if (pathname.startsWith("/admin")) {
    if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));
    if (role !== "admin")
      return NextResponse.redirect(new URL("/", request.url));
  }

  // Schülerportal: nur eingeloggte Schüler – Admins gehören ins Admin-Panel
  if (pathname.startsWith("/schueler")) {
    if (!user)
      return NextResponse.redirect(new URL("/auth/login", request.url));
    if (role === "admin")
      return NextResponse.redirect(new URL("/admin", request.url));
  }

  // Bereits eingeloggt? Login/Register überspringen und passend weiterleiten.
  if (
    (pathname.startsWith("/auth/login") ||
      pathname.startsWith("/auth/register")) &&
    user
  ) {
    return NextResponse.redirect(
      new URL(role === "admin" ? "/admin" : "/schueler/portal", request.url)
    );
  }

  return supabaseResponse;
}
