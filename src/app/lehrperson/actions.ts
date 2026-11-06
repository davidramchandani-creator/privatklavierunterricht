"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Aktionen der Lehrperson.
 *
 * Nur mit der Sitzung der Lehrperson (`createClient`), nie mit dem
 * Service-Schlüssel. Was hier erlaubt ist, entscheidet RLS in der
 * Datenbank: Eine Bestätigung darf sie nur für sich selbst schreiben.
 */
export async function leitbildBestaetigen(versionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data: ich } = await supabase.from("teachers").select("id").eq("profile_id", user.id).maybeSingle();
  if (!ich) return { error: "Kein Lehrpersonen-Konto." };

  const { error } = await supabase
    .from("leitbild_bestaetigungen")
    .insert({ version_id: versionId, teacher_id: ich.id });
  if (error && error.code !== "23505") return { error: "Die Bestätigung hat nicht geklappt." };

  revalidatePath("/lehrperson");
  return { success: true as const };
}
