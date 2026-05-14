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
    .from("profile_roles")
    .select("role")
    .eq("user_id", user.id)
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
