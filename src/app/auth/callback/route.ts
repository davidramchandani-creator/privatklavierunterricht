import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/schueler/portal";
  const supabase = await createClient();

  // PKCE flow (standard login / password-reset from browser)
  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // Token-hash flow (admin-generated links via admin.generateLink)
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "recovery" | "invite" | "email" | null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // Fällt der Token-Tausch fehl (z. B. weil eine iOS-Mail-Vorschau den Einmal-
  // Token bereits konsumiert hat), aber es besteht schon eine gültige Session,
  // leiten wir trotzdem weiter statt einen Fehler anzuzeigen.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return NextResponse.redirect(`${origin}${next}`);

  return NextResponse.redirect(`${origin}/auth/login?error=link_ungueltig`);
}
