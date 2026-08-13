"use server";

import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email-sender";
import { renderEmail } from "@/lib/email-templates";

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
  const email = formData.get("email") as string;
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://privatklavierunterricht.ch";

  // Admin-Client verwenden, damit wir den token_hash selbst erhalten und die
  // E-Mail über Resend (branded Template) versenden können, statt via
  // Supabases eigenem Mailer. Ausserdem verhindert die /auth/bestaetigen-URL,
  // dass iOS-Mail-Vorschauen den Einmal-Token schon beim Vorladen verbrennen.
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${origin}/auth/passwort-setzen`,
    },
  });

  // Auch bei Fehler/unbekannter E-Mail immer Erfolg melden (kein User-Enumeration).
  if (!error && data?.properties?.hashed_token) {
    const tokenHash = data.properties.hashed_token;
    const resetUrl = `${origin}/auth/bestaetigen?token_hash=${tokenHash}&type=recovery&next=/auth/passwort-setzen`;
    const rendered = renderEmail("password_reset", { reset_url: resetUrl });
    if (rendered) {
      await sendEmail({ to: email, subject: rendered.subject, html: rendered.html }).catch(() => {});
    }
  }

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
