"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { istLeer } from "@/lib/lektionsnotizen";

/**
 * Server Actions sind auch ohne die Admin-Seiten direkt aufrufbar. Die
 * Middleware schützt nur die Seiten, also prüft jede Action die Rolle selbst.
 */
async function assertAdmin(): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") return { error: "Keine Berechtigung." };
  return null;
}

export type NotizEingabe = {
  appointmentId: string;
  inhalt: string[];
  verlauf: string | null;
  woran: string;
  hausaufgabe: string;
};

/**
 * Notiz zu einer Lektion speichern oder überschreiben.
 *
 * `upsert` auf `appointment_id`: Nachtragen bearbeitet den bestehenden
 * Eintrag. Ein zweiter Eintrag zur selben Stunde wäre im Verlauf nicht mehr
 * auseinanderzuhalten, und die Datenbank verbietet ihn ohnehin.
 */
export async function speichereNotiz(eingabe: NotizEingabe) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const woran = eingabe.woran.trim();
  const hausaufgabe = eingabe.hausaufgabe.trim();

  if (istLeer({ ...eingabe, woran, hausaufgabe })) {
    // Ein leerer Eintrag wäre schlimmer als keiner: Die Lektion verschwände
    // aus der Liste der offenen Notizen, ohne dass irgendwo etwas stünde.
    return { error: "Tipp wenigstens einen Knopf an." };
  }

  const admin = await createAdminClient();

  // Der Schüler wird aus dem Termin gelesen, nicht vom Client übernommen.
  // Sonst könnte eine Notiz an einem fremden Schüler landen.
  const { data: termin } = await admin
    .from("appointments")
    .select("student_id")
    .eq("id", eingabe.appointmentId)
    .maybeSingle();

  if (!termin) return { error: "Diese Lektion gibt es nicht." };

  const { error } = await admin.from("lektionsnotizen").upsert(
    {
      appointment_id: eingabe.appointmentId,
      student_id: termin.student_id,
      inhalt: eingabe.inhalt,
      verlauf: eingabe.verlauf,
      woran: woran || null,
      hausaufgabe: hausaufgabe || null,
    },
    { onConflict: "appointment_id" }
  );

  if (error) {
    console.error("[notiz] Speichern fehlgeschlagen:", error.message);
    return { error: "Konnte nicht gespeichert werden." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/lektionen");
  revalidatePath(`/admin/schueler/${termin.student_id}`);
  return { success: true as const };
}

/** Notiz wieder entfernen. Die Lektion taucht danach als offen auf. */
export async function loescheNotiz(appointmentId: string) {
  const verboten = await assertAdmin();
  if (verboten) return verboten;

  const admin = await createAdminClient();
  const { data: vorher } = await admin
    .from("lektionsnotizen")
    .select("student_id")
    .eq("appointment_id", appointmentId)
    .maybeSingle();

  await admin
    .from("lektionsnotizen")
    .delete()
    .eq("appointment_id", appointmentId);

  revalidatePath("/admin");
  revalidatePath("/admin/lektionen");
  if (vorher) revalidatePath(`/admin/schueler/${vorher.student_id}`);
  return { success: true as const };
}
