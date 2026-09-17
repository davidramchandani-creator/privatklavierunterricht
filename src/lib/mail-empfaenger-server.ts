import type { SupabaseClient } from "@supabase/supabase-js";
import { empfaengerFuer, type Adresse } from "./mail-kategorien";

export type SchuelerAdressen = {
  haupt: Adresse | null;
  weitere: (Adresse & { id: string; bezeichnung: string | null })[];
  studentName: string;
  extern: boolean;
};

/** Hauptadresse samt Kategorien und alle weiteren Adressen eines Schülers. */
export async function ladeAdressen(
  admin: SupabaseClient,
  studentId: string
): Promise<SchuelerAdressen | null> {
  const [{ data: profil }, { data: weitere }] = await Promise.all([
    admin
      .from("profiles")
      .select("email, mail_kategorien, vorname, nachname, extern")
      .eq("id", studentId)
      .maybeSingle(),
    admin
      .from("schueler_mailadressen")
      .select("id, email, bezeichnung, kategorien")
      .eq("student_id", studentId)
      .order("erstellt_am"),
  ]);
  if (!profil) return null;
  return {
    haupt: profil.email
      ? { email: String(profil.email), kategorien: (profil.mail_kategorien as string[]) ?? [] }
      : null,
    weitere: (weitere ?? []).map((w) => ({
      id: w.id as string,
      email: String(w.email),
      bezeichnung: (w.bezeichnung as string | null) ?? null,
      kategorien: (w.kategorien as string[]) ?? [],
    })),
    studentName: `${profil.vorname ?? ""} ${profil.nachname ?? ""}`.trim(),
    extern: profil.extern === true,
  };
}

/** Die Empfänger einer Mail dieses Typs an diesen Schüler. */
export async function ladeEmpfaenger(
  admin: SupabaseClient,
  studentId: string,
  type: string
): Promise<{ an: string[]; studentName: string } | null> {
  const a = await ladeAdressen(admin, studentId);
  if (!a) return null;
  return { an: empfaengerFuer(type, a.haupt, a.weitere), studentName: a.studentName };
}
