"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { setzeFestenPlatz } from "@/lib/freigabe-server";

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

const HHMM = /^\d{2}:\d{2}$/;

/** Den festen Platz eines laufenden Abos ändern. */
export async function festenPlatzAendern(
  studentId: string,
  platz: {
    wochentag: number;
    beginn: string;
    paritaet: 0 | 1 | null;
    beginnUngerade: string | null;
  },
  mitMail: boolean
): Promise<{ success: true; error: undefined; termine: number; mail: boolean } | { error: string }> {
  const verboten = await assertAdmin();
  if (verboten) return verboten;
  if (!Number.isInteger(platz.wochentag) || platz.wochentag < 0 || platz.wochentag > 6) {
    return { error: "Bitte einen Wochentag wählen." };
  }
  if (!HHMM.test(platz.beginn)) return { error: "Bitte eine Uhrzeit angeben." };
  const zweite = platz.beginnUngerade && HHMM.test(platz.beginnUngerade) ? platz.beginnUngerade : null;

  const admin = await createAdminClient();
  const r = await setzeFestenPlatz(admin, studentId, { ...platz, beginnUngerade: zweite }, mitMail);
  if ("error" in r) return r;

  revalidatePath(`/admin/schueler/${studentId}`);
  revalidatePath("/admin/kalender");
  revalidatePath("/admin/planung");
  revalidatePath("/schueler/portal");
  return { success: true, error: undefined, termine: r.termine, mail: r.mail };
}
