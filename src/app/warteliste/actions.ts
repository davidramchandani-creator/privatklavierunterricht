"use server";

import { updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email-sender";
import { renderEmail } from "@/lib/email-templates";
import { PLATZSTATUS_TAG, ladePlatzstatus } from "@/lib/platzstatus-server";
import type { Platzstatus } from "@/lib/platzstatus";
import { angebotZustand, pruefeAnmeldung } from "@/lib/warteliste";

/** Für die Probelektion-Seite, die selbst eine Client-Komponente ist. */
export async function holePlatzstatus(): Promise<Platzstatus> {
  return ladePlatzstatus();
}

/**
 * Öffentliche Anmeldung auf die Warteliste.
 *
 * Geschrieben wird mit dem Service-Client, weil die Tabelle für Besucher
 * gesperrt ist (RLS nur Admin). Geprüft wird darum hier, vollständig.
 */
export async function meldeWarteliste(formData: FormData) {
  // Honigtopf: Menschen sehen das Feld nicht, Bots füllen es aus.
  if (String(formData.get("firma") ?? "").trim() !== "") return { ok: true as const };

  const geprueft = pruefeAnmeldung(formData);
  if (!geprueft.ok) return { error: geprueft.fehler };
  const d = geprueft.daten;

  const admin = createAdminClient();
  const { error } = await admin.from("warteliste").insert({ ...d, quelle: "webseite" });

  if (error) {
    // 23505: dieselbe Adresse wartet schon (eindeutiger Index).
    if (error.code === "23505") {
      return { error: "Mit dieser E-Mail-Adresse stehst du schon auf der Warteliste." };
    }
    return { error: "Die Anmeldung hat nicht geklappt. Bitte versuche es nochmals." };
  }

  updateTag(PLATZSTATUS_TAG);

  const bestaetigung = renderEmail("warteliste_bestaetigung", d);
  if (bestaetigung) {
    await sendEmail({ to: d.email, subject: bestaetigung.subject, html: bestaetigung.html }).catch(
      () => null
    );
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const info = renderEmail("warteliste_admin", d);
    if (info) {
      await sendEmail({ to: adminEmail, subject: info.subject, html: info.html }).catch(() => null);
    }
  }

  return { ok: true as const };
}

/**
 * Antwort auf ein Angebot aus dem Mail.
 *
 * Der Link enthält nur das Token. Zu- oder Absagen braucht einen Klick auf
 * der Seite, nicht schon das Öffnen des Links: Manche Mailprogramme rufen
 * Links zur Vorschau auf, und das darf keine Zusage auslösen.
 */
export async function antworteAufAngebot(
  token: string,
  zusage: boolean,
  bleibtAufListe: boolean
) {
  if (!token || token.length < 20) return { error: "Dieser Link ist ungültig." };

  const admin = createAdminClient();
  const { data: eintrag } = await admin
    .from("warteliste")
    .select("id, vorname, nachname, email, status, angebot_text, angebot_frist")
    .eq("angebot_token", token)
    .maybeSingle();

  const zustand = angebotZustand(eintrag, new Date());
  if (zustand === "ungueltig") return { error: "Dieser Link ist ungültig." };
  if (zustand === "beantwortet") return { error: "Du hast auf dieses Angebot schon geantwortet." };
  if (zustand === "abgelaufen") {
    return { error: "Die Frist für dieses Angebot ist leider abgelaufen. Du bleibst auf der Warteliste." };
  }

  const neuerStatus = zusage ? "zugesagt" : bleibtAufListe ? "wartend" : "abgelehnt";
  const jetzt = new Date().toISOString();

  // Nur ändern, solange es noch ein offenes Angebot ist. Verhindert, dass
  // ein Doppelklick zweimal eine Mail an David auslöst.
  const { data: geaendert } = await admin
    .from("warteliste")
    .update({
      status: neuerStatus,
      beantwortet_am: jetzt,
      aktualisiert_am: jetzt,
      // Wer bleibt, wartet wieder ganz normal. Das alte Angebot gilt nicht mehr.
      ...(neuerStatus === "wartend"
        ? { angebot_token: null, angebot_frist: null }
        : {}),
    })
    .eq("id", eintrag!.id)
    .eq("status", "angeboten")
    .select("id");

  if (!geaendert || geaendert.length === 0) {
    return { error: "Du hast auf dieses Angebot schon geantwortet." };
  }

  updateTag(PLATZSTATUS_TAG);

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const info = renderEmail("warteliste_antwort_admin", {
      vorname: eintrag!.vorname,
      nachname: eintrag!.nachname,
      angebot_text: eintrag!.angebot_text,
      zugesagt: zusage,
      bleibt_auf_liste: !zusage && bleibtAufListe,
    });
    if (info) {
      await sendEmail({ to: adminEmail, subject: info.subject, html: info.html }).catch(() => null);
    }
  }

  return { ok: true as const, status: neuerStatus };
}
