"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { sendEmailNow } from "@/lib/emails-outbox";

/**
 * Eine Bewertung entgegennehmen.
 *
 * Läuft über den Admin-Zugang, nicht über die Rechte des Besuchers: Es gibt
 * bewusst keine Regel, die Fremden das Schreiben in die Tabelle erlaubt.
 * Der Token ist der einzige Schlüssel, und er wird hier geprüft, nicht im
 * Browser. Alles, was der Browser behauptet, kann jemand behaupten.
 */
export async function bewertungAbgeben(
  token: string,
  sterne: number,
  text: string,
  name: string,
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const admin = await createAdminClient();

  // Ganze Zahl von 1 bis 5. Ein Formular schickt keine 4.5 und keine 7,
  // ein selbstgebauter Aufruf schon.
  const wertung = Math.round(Number(sterne));
  if (!Number.isFinite(wertung) || wertung < 1 || wertung > 5) {
    return { ok: false, fehler: "Bitte wähle zwischen einem und fünf Sternen." };
  }

  const { data: einladung } = await admin
    .from("review_einladungen")
    .select("id, student_id, benutzt_am")
    .eq("token", token)
    .maybeSingle();

  if (!einladung) {
    return { ok: false, fehler: "Dieser Link ist ungültig." };
  }
  if (einladung.benutzt_am) {
    // Nicht als Fehler formulieren: Meistens hat jemand zweimal auf
    // Senden gedrückt oder den Link nochmal geöffnet.
    return { ok: false, fehler: "Für diesen Link wurde bereits eine Bewertung abgegeben." };
  }

  const sauberText = text.trim();
  const sauberName = name.trim();

  // Ein Zitat ohne Absender wirkt erfunden, deshalb verlangt schon die
  // Datenbank einen Namen zum Text. Hier dieselbe Regel, nur freundlicher
  // formuliert.
  if (sauberText.length > 0 && sauberName.length === 0) {
    return { ok: false, fehler: "Bitte gib deinen Vornamen an, wenn du etwas schreibst." };
  }
  if (sauberText.length > 2000) {
    return { ok: false, fehler: "Der Text ist zu lang, bitte kürze ihn etwas." };
  }

  const { data: review, error } = await admin
    .from("reviews")
    .insert({
      student_id: einladung.student_id,
      name: sauberName.length > 0 ? sauberName : null,
      sterne: wertung,
      text: sauberText.length > 0 ? sauberText : null,
      status: "offen",
      quelle: "formular",
    })
    .select("id")
    .single();

  if (error || !review) {
    return { ok: false, fehler: "Das hat leider nicht geklappt. Bitte versuche es nochmal." };
  }

  // Erst jetzt entwerten. Andersherum wäre der Link verbraucht, während die
  // Bewertung im Nichts gelandet ist.
  await admin
    .from("review_einladungen")
    .update({ benutzt_am: new Date().toISOString(), review_id: review.id })
    .eq("id", einladung.id);

  // David muss davon erfahren, sonst wartet die Bewertung unbemerkt auf
  // Freigabe und erscheint nie.
  await sendEmailNow(admin, "bewertung_eingegangen", {
    student_id: einladung.student_id,
    name: sauberName || "ohne Namen",
    sterne: wertung,
    text: sauberText || null,
  });

  return { ok: true };
}
