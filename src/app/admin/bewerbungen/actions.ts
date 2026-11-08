"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email-sender";
import { renderEmail } from "@/lib/email-templates";
import type { BewerbungStatus } from "@/lib/bewerbung";

async function assertAdmin(): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const { data: istAdmin } = await supabase.rpc("is_admin");
  if (istAdmin !== true) return { error: "Keine Berechtigung." };
  return null;
}

const STATI: BewerbungStatus[] = ["neu", "gespraech", "probelektion", "zusage", "absage", "zurueckgezogen"];

/**
 * Stufe ändern, auf Wunsch mit Mail. Den Text hat David vorher in der
 * Vorlage angepasst; er geht genau so raus.
 */
export async function bewerbungStufe(
  id: string,
  status: BewerbungStatus,
  mail: { betreff: string; text: string } | null
) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  if (!STATI.includes(status)) return { error: "Unbekannte Stufe." };

  const admin = createAdminClient();
  const { data: b } = await admin.from("bewerbungen").select("email").eq("id", id).maybeSingle();
  if (!b) return { error: "Bewerbung nicht gefunden." };

  if (mail) {
    if (!mail.betreff.trim() || !mail.text.trim()) return { error: "Betreff und Text dürfen nicht leer sein." };
    const m = renderEmail("bewerbung_freitext", { betreff: mail.betreff.trim(), text: mail.text.trim() });
    if (!m) return { error: "Mailvorlage fehlt." };
    try {
      await sendEmail({ to: b.email, subject: m.subject, html: m.html });
    } catch (e) {
      return { error: "Mail nicht gesendet: " + (e instanceof Error ? e.message : String(e)) };
    }
  }

  const { error } = await admin
    .from("bewerbungen")
    .update({ status, aktualisiert_am: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/bewerbungen");
  return { success: true as const };
}

export async function bewerbungNotiz(id: string, notizen: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = createAdminClient();
  const { error } = await admin
    .from("bewerbungen")
    .update({ notizen: notizen.trim() || null, aktualisiert_am: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/bewerbungen");
  return { success: true as const };
}

/** Endgültig löschen (Datenschutz: auf Wunsch der Person). */
export async function bewerbungLoeschen(id: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = createAdminClient();
  const { error } = await admin.from("bewerbungen").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/bewerbungen");
  return { success: true as const };
}
