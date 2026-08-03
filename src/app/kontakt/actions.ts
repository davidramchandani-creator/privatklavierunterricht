"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { renderEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email-sender";
import { dispatchPush } from "@/lib/email-dispatch";

/**
 * Kontaktformular: speichert die Anfrage (quelle = 'kontakt') und benachrichtigt
 * den Admin per Mail + Push. Der Absender bekommt eine Bestätigung.
 */
export async function submitKontakt(formData: FormData) {
  const vorname = (formData.get("vorname") as string)?.trim();
  const nachname = (formData.get("nachname") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const telefon = (formData.get("telefon") as string)?.trim() || null;
  const betreff = (formData.get("betreff") as string)?.trim() || null;
  const nachricht = (formData.get("nachricht") as string)?.trim();

  if (!vorname || !nachname || !email || !nachricht) {
    return { error: "Bitte fülle Name, E-Mail und Nachricht aus." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Ungültige E-Mail-Adresse." };
  }
  if (nachricht.length > 5000) {
    return { error: "Die Nachricht ist zu lang (max. 5000 Zeichen)." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("anfragen").insert({
    vorname,
    nachname,
    email,
    telefon,
    nachricht,
    betreff,
    quelle: "kontakt",
  });

  if (error) {
    console.error("[kontakt] insert:", error.message);
    return { error: "Nachricht konnte nicht gesendet werden. Bitte versuche es erneut." };
  }

  const payload = { vorname, nachname, email, telefon, nachricht, betreff, quelle: "kontakt" };
  const admin = await createAdminClient();

  // Bestätigung an den Absender.
  const confirm = renderEmail("kontakt_received", payload);
  if (confirm) {
    try {
      await sendEmail({ to: email, subject: confirm.subject, html: confirm.html });
    } catch (err) {
      console.error("[kontakt] Bestätigungsmail:", err);
    }
  }

  // Benachrichtigung an den Admin (Mail + Push).
  const adminMail = renderEmail("kontakt_admin", payload);
  const adminTo = process.env.ADMIN_EMAIL;
  if (adminMail && adminTo) {
    try {
      await sendEmail({ to: adminTo, subject: adminMail.subject, html: adminMail.html });
    } catch (err) {
      console.error("[kontakt] Admin-Mail:", err);
    }
  }
  await dispatchPush(admin, "anfrage_admin", payload);

  return { success: true };
}
