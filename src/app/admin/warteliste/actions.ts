"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email-sender";
import { renderEmail } from "@/lib/email-templates";
import { PLATZSTATUS_TAG } from "@/lib/platzstatus-server";
import { EINSTELLUNG_PLAETZE } from "@/lib/platzstatus";
import {
  ANGEBOT_FRIST_TAGE,
  angebotFrist,
  neuesToken,
  pruefeAnmeldung,
  type WartelistenStatus,
} from "@/lib/warteliste";

async function assertAdmin(): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profil?.role !== "admin") return { error: "Keine Berechtigung." };
  return null;
}

function fertig() {
  updateTag(PLATZSTATUS_TAG);
  revalidatePath("/admin/warteliste");
}

/** David trägt selbst jemanden ein (Mail, Telefon, Matchspace). Ohne Mail. */
export async function wartelisteEintragen(formData: FormData) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const geprueft = pruefeAnmeldung(formData);
  if (!geprueft.ok) return { error: geprueft.fehler };

  const admin = createAdminClient();
  const notizen = String(formData.get("notizen") ?? "").trim() || null;
  const { error } = await admin
    .from("warteliste")
    .insert({ ...geprueft.daten, quelle: "admin", notizen });
  if (error) {
    if (error.code === "23505") return { error: "Diese Adresse steht schon auf der Warteliste." };
    return { error: error.message };
  }
  fertig();
  return { success: true as const };
}

/**
 * Einen frei gewordenen Platz anbieten.
 *
 * Schickt das Mail mit dem Link sofort. Läuft die Frist ab, ohne dass die
 * Person antwortet, bleibt der Eintrag „angeboten“ und die Seite zeigt ihn
 * als abgelaufen. David entscheidet dann selbst, ob er den Platz der
 * nächsten Person anbietet.
 */
export async function platzAnbieten(id: string, angebotText: string, fristTage: number) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const text = angebotText.trim();
  if (!text) return { error: "Bitte beschreib den Platz, z. B. „Montag 17:00, alle zwei Wochen, ab 22. Februar“." };

  const admin = createAdminClient();
  const { data: eintrag } = await admin
    .from("warteliste")
    .select("id, vorname, email, status")
    .eq("id", id)
    .maybeSingle();
  if (!eintrag) return { error: "Eintrag nicht gefunden." };
  if (eintrag.status !== "wartend" && eintrag.status !== "angeboten") {
    return { error: "Diese Person wartet nicht mehr." };
  }

  const jetzt = new Date();
  const frist = angebotFrist(jetzt, fristTage || ANGEBOT_FRIST_TAGE);
  const token = neuesToken();

  const { error } = await admin
    .from("warteliste")
    .update({
      status: "angeboten",
      angebot_text: text,
      angebot_frist: frist.toISOString(),
      angebot_token: token,
      angeboten_am: jetzt.toISOString(),
      beantwortet_am: null,
      aktualisiert_am: jetzt.toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  const mail = renderEmail("warteliste_angebot", {
    vorname: eintrag.vorname,
    angebot_text: text,
    angebot_frist: frist.toISOString(),
    token,
  });
  if (!mail) return { error: "Mailvorlage fehlt." };
  try {
    await sendEmail({ to: eintrag.email, subject: mail.subject, html: mail.html });
  } catch (e) {
    fertig();
    return {
      error:
        "Das Angebot ist gespeichert, aber das Mail ging nicht raus: " +
        (e instanceof Error ? e.message : String(e)),
    };
  }

  fertig();
  return { success: true as const };
}

/** Status von Hand setzen (zurück auf wartend, entfernen, zugesagt). */
export async function wartelisteStatus(id: string, status: WartelistenStatus) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = createAdminClient();
  const jetzt = new Date().toISOString();
  const { error } = await admin
    .from("warteliste")
    .update({
      status,
      aktualisiert_am: jetzt,
      ...(status === "wartend" ? { angebot_token: null, angebot_frist: null } : {}),
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "Diese Adresse wartet bereits in einem anderen Eintrag." };
    return { error: error.message };
  }
  fertig();
  return { success: true as const };
}

export async function wartelisteNotiz(id: string, notizen: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = createAdminClient();
  const { error } = await admin
    .from("warteliste")
    .update({ notizen: notizen.trim() || null, aktualisiert_am: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/warteliste");
  return { success: true as const };
}

/** Endgültig löschen, z. B. bei Spam. */
export async function wartelisteLoeschen(id: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = createAdminClient();
  const { error } = await admin.from("warteliste").delete().eq("id", id);
  if (error) return { error: error.message };
  fertig();
  return { success: true as const };
}

/** Den Platzstatus sofort neu rechnen, statt bis zu einer Stunde zu warten. */
export async function platzstatusNeuRechnen() {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  fertig();
  return { success: true as const };
}

/**
 * Freie Plätze selbst eintragen.
 *
 * `aktiv = false` schaltet zurück auf die gerechnete Zahl. Zahl und Zusatz
 * bleiben dabei gespeichert, damit sie beim Wiedereinschalten noch da sind.
 */
export async function freiePlaetzeSpeichern(aktiv: boolean, freie: number, zusatz: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const zahl = Math.round(Number(freie));
  if (!Number.isFinite(zahl) || zahl < 0 || zahl > 99) {
    return { error: "Bitte eine Zahl zwischen 0 und 99 eintragen." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").upsert({
    key: EINSTELLUNG_PLAETZE,
    value: { aktiv, freie: zahl, zusatz: zusatz.trim().slice(0, 60) || null },
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  fertig();
  return { success: true as const };
}
