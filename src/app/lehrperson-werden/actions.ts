"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email-sender";
import { renderEmail } from "@/lib/email-templates";
import { hinweise, pruefeBewerbung } from "@/lib/bewerbung";

/**
 * Bewerbung als Lehrperson. Öffentlich, darum hier vollständig geprüft;
 * gespeichert wird mit dem Service-Schlüssel, weil die Tabelle nur für
 * David lesbar ist.
 */
export async function bewerben(roh: Record<string, unknown>) {
  // Honigtopf gegen Bots
  if (typeof roh.firma === "string" && roh.firma.trim() !== "") return { ok: true as const };

  const geprueft = pruefeBewerbung(roh);
  if (!geprueft.ok) return { error: geprueft.fehler };
  const d = geprueft.daten;

  const admin = createAdminClient();
  const { error } = await admin.from("bewerbungen").insert(d);
  if (error) {
    if (error.code === "23505") {
      return { error: "Mit dieser E-Mail-Adresse liegt schon eine Bewerbung bei mir. Ich melde mich bei dir." };
    }
    return { error: "Das hat leider nicht geklappt. Bitte versuche es nochmals." };
  }

  const bestaetigung = renderEmail("bewerbung_bestaetigung", d);
  if (bestaetigung) {
    await sendEmail({ to: d.email, subject: bestaetigung.subject, html: bestaetigung.html }).catch(() => null);
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const info = renderEmail("bewerbung_admin", { ...d, ...hinweise(d) });
    if (info) await sendEmail({ to: adminEmail, subject: info.subject, html: info.html }).catch(() => null);
  }
  return { ok: true as const };
}
