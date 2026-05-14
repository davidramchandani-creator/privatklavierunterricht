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

  if (pathname.startsWith("/admin")) {
    if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));
    const { data: profile } = await supabase
      .from("profile_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (profile?.role !== "admin")
      return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname.startsWith("/schueler") && !user)
    return NextResponse.redirect(new URL("/auth/login", request.url));

  if (
    (pathname.startsWith("/auth/login") ||
      pathname.startsWith("/auth/register")) &&
    user
  ) {
    const { data: profile } = await supabase
      .from("profile_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    return NextResponse.redirect(
      new URL(
        profile?.role === "admin" ? "/admin" : "/schueler/portal",
        request.url
      )
    );
  }

  return supabaseResponse;
}
