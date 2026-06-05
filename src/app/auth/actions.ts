"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "E-Mail oder Passwort falsch. Bitte erneut versuchen." };
  }

  // Rolle prüfen und weiterleiten
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Anmeldung fehlgeschlagen." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  }
  redirect("/schueler/portal");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function setPassword(formData: FormData) {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmation = formData.get("confirmation") as string;

  if (password !== confirmation) {
    return { error: "Die Passwörter stimmen nicht überein." };
  }
  if (password.length < 8) {
    return { error: "Das Passwort muss mindestens 8 Zeichen lang sein." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "Passwort konnte nicht gesetzt werden. Bitte Link erneut anfordern." };
  }

  redirect("/schueler/portal");
}

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://privatklavierunterricht.ch";

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/passwort-setzen`,
  });

  // Immer Erfolg zurückgeben (kein User-Enumeration)
  return { success: true };
}

/**
 * Löst den Recovery-/Invite-Token aus einem E-Mail-Link erst NACH einem echten
 * Klick ein. Wichtig gegen iOS-Mail-Vorschau & Link-Scanner, die den Link
 * automatisch laden und so den Einmal-Token verbrennen würden (siehe
 * /auth/bestaetigen). Der Token wird hier per token_hash übergeben, NICHT über
 * Supabases /verify-Endpoint, der schon beim Vorschau-Laden konsumieren würde.
 */
export async function confirmEmailToken(tokenHash: string, type: string, next: string) {
  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "recovery" | "invite" | "email",
  });

  if (error) {
    // Falls der Token bereits eingelöst wurde (z. B. Doppelklick), die Session
    // aber bereits steht, trotzdem weiterleiten statt einen Fehler zu zeigen.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect(next);
    return { error: "Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an." };
  }

  redirect(next);
}
