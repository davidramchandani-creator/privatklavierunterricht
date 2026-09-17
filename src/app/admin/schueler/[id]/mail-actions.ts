"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { KATEGORIEN, type MailKategorie } from "@/lib/mail-kategorien";

/**
 * Mailadressen eines Schülers verwalten.
 *
 * Die Hauptadresse (profiles.email) wird hier nicht geändert, nur ihre
 * Kategorien: Sie ist die Adresse des Login-Kontos, und die ändert man
 * über „Bearbeiten" in den Stammdaten, damit Konto und Profil zusammen
 * bleiben.
 */

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

function sauber(kategorien: unknown): MailKategorie[] {
  if (!Array.isArray(kategorien)) return [];
  return KATEGORIEN.filter((k) => kategorien.includes(k));
}

function gueltigeMail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type Ergebnis = { success: true; error: undefined } | { error: string };

export async function mailadresseHinzufuegen(
  studentId: string,
  email: string,
  bezeichnung: string,
  kategorien: string[]
): Promise<Ergebnis> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const adresse = email.trim().toLowerCase();
  if (!gueltigeMail(adresse)) return { error: "Das sieht nicht nach einer Mailadresse aus." };

  const admin = await createAdminClient();
  const { data: profil } = await admin
    .from("profiles")
    .select("email")
    .eq("id", studentId)
    .maybeSingle();
  if ((profil?.email ?? "").toLowerCase() === adresse) {
    return { error: "Das ist schon die Hauptadresse." };
  }

  const { error } = await admin.from("schueler_mailadressen").insert({
    student_id: studentId,
    email: adresse,
    bezeichnung: bezeichnung.trim() || null,
    kategorien: sauber(kategorien),
  });
  if (error) {
    return {
      error: error.code === "23505" ? "Diese Adresse ist schon eingetragen." : error.message,
    };
  }
  revalidatePath(`/admin/schueler/${studentId}`);
  return { success: true, error: undefined };
}

export async function mailadresseKategorienSetzen(
  id: string,
  kategorien: string[]
): Promise<Ergebnis> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("schueler_mailadressen")
    .update({ kategorien: sauber(kategorien) })
    .eq("id", id)
    .select("student_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (data?.student_id) revalidatePath(`/admin/schueler/${data.student_id}`);
  return { success: true, error: undefined };
}

export async function mailadresseEntfernen(id: string): Promise<Ergebnis> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("schueler_mailadressen")
    .delete()
    .eq("id", id)
    .select("student_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (data?.student_id) revalidatePath(`/admin/schueler/${data.student_id}`);
  return { success: true, error: undefined };
}

/** Welche Kategorien die Hauptadresse bekommt. */
export async function hauptKategorienSetzen(
  studentId: string,
  kategorien: string[]
): Promise<Ergebnis> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = await createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ mail_kategorien: sauber(kategorien) })
    .eq("id", studentId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/schueler/${studentId}`);
  return { success: true, error: undefined };
}
