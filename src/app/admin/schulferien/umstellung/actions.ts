"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { fuehreUmstellungAus, stelleExternUm } from "@/lib/semester-umstellung-server";

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

/** Ein Abo umstellen. Läuft nur auf Davids Klick, die Mail nur mit Häkchen. */
export async function aboUmstellen(
  packageId: string,
  mitMail: boolean
): Promise<{ success: true; error: undefined; mail: boolean } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = await createAdminClient();
  const r = await fuehreUmstellungAus(admin, packageId, mitMail);
  if ("error" in r) return r;
  revalidatePath("/admin/schulferien/umstellung");
  revalidatePath(`/admin/schueler/${r.zeile.studentId}`);
  revalidatePath("/admin/zahlungen");
  revalidatePath("/admin/kalender");
  revalidatePath("/schueler/portal");
  return { success: true, error: undefined, mail: r.mail };
}

/** Termine eines externen Schülers nach den neuen freien Zeiten neu legen. */
export async function externUmstellen(
  studentId: string
): Promise<{ success: true; error: undefined; termine: number } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  const admin = await createAdminClient();
  const r = await stelleExternUm(admin, studentId);
  if ("error" in r) return r;
  revalidatePath("/admin/schulferien/umstellung");
  revalidatePath("/admin/kalender");
  return { success: true, error: undefined, termine: r.termine };
}
